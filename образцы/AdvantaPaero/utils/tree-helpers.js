export async function expandAllNodesRecursive(scrollSelector, plusImgSelector) {
  const scroll = document.querySelector('project-tree')?.querySelector(scrollSelector) || window;
  const clickNode = (el) => ['mousedown', 'click', 'mouseup'].forEach(t => el.dispatchEvent(new MouseEvent(t, { bubbles: true, cancelable: true, view: window, buttons: 1 })));
  
  let lastY = -1, noChange = 0, total = 0;
  while (noChange < 10) {
    const btn = Array.from(document.querySelectorAll(plusImgSelector)).find(b => b.offsetHeight > 0 && b.src.includes('plusGray'));
    if (btn) {
      btn.scrollIntoView({ block: 'center' });
      await new Promise(r => setTimeout(r, 100));
      clickNode(btn);
      total++;
      await new Promise(r => setTimeout(r, 500));
    }
    const curY = scroll === window ? window.scrollY : scroll.scrollTop;
    if (curY === lastY && !btn) noChange++; else { noChange = 0; lastY = curY; }
    if (scroll === window) window.scrollBy(0, 300); else scroll.scrollTop += 300;
    await new Promise(r => setTimeout(r, 150));
  }
  console.log(`🏁 Раскрытие дерева завершено. Развернуто веток: ${total}`);
}

export function parseDomStructureIntoMap(storageMap) {
  Array.from(document.querySelectorAll('project-tree [class*="_treeItem_"]')).forEach(item => {
    try {
      const box = item.querySelector('[class*="_treeItemContent_"]') || item;
      const nEl = box.querySelector('[class*="_projectLink_"]'); if (!nEl) return;
      const name = nEl.textContent.trim(), link = nEl.getAttribute('href') || ''; if (!name || !link) return;
      const uid = link.match(/uid=([^&]+)/) ? link.match(/uid=([^&]+)/)[1] : link;
      
      storageMap.set(uid, {
        level: Math.round((parseInt(item.style.marginLeft || '0px', 10) || 0) / 26),
        code: box.querySelector('[class*="_projectCode_"], [class*="_projectNumber_"]')?.textContent.trim() || '-',
        name: name, link: link.startsWith('http') ? link : window.location.origin + link,
        status: box.querySelector('.ui-status__list-item-text')?.textContent.trim() || '-',
        priority: '-', progress: '0%', manager: '-', executor: '-', planStart: '-', planEnd: '-', factStart: '-', factEnd: '-',
        planHours: '-', factHours: '-', allocatedHours: '-'
      });
    } catch (e) {}
  });
}
