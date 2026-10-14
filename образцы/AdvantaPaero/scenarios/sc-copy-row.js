import { parseActiveScreenHours } from '../utils/data-helpers.js';

export async function run() {
  const currentUrl = window.location.href;
  const cleanTitle = (document.title || 'Задача').replace(/[\r\n\t]/g, '').trim();
  const statusText = document.querySelector('.projectStatistics #ctl34_cpProgressBar_projectPercentBar')?.textContent.trim() || '-';
  const progressPercent = document.querySelector('.projectStatistics #ctl34_cpProgressBar_projectPercentLabel')?.textContent.trim() || '0%';
  
  const hScreen = parseActiveScreenHours();

  const formattedExcelRow = [
    "-1", "0", `"${cleanTitle}"`, `"=ГИПЕРССЫЛКА(""${currentUrl}"";""ПроектЦентр"")"`,
    `"${statusText}"`, `"-"`, `"${progressPercent}"`, "-", "-", "-", "-", "-", "-",
    `"${hScreen.plan}"`, `"${hScreen.fact}"`, `"${hScreen.alloc}"`
  ].join(";");

  navigator.clipboard.writeText(formattedExcelRow);
}
