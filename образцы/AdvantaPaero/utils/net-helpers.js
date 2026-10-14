export async function fetchHoursViaDMPacket(uid, projectUrl, viewStateKey, controllerKey) {
  const failValues = { plan: '-', fact: '-', alloc: '-' };
  try {
    const payload = new URLSearchParams();
    payload.append('__VIEWSTATE_KEY', viewStateKey); payload.append('__CONTROLLER_KEY', controllerKey);
    payload.append('__CALLBACKID', 'ctl34$cbKeyMeasureWidgets');
    payload.append('__CALLBACKPARAM', `c0:{"id":0,"result":{"data":"","parameter":"${uid}"}}`);

    const response = await fetch(projectUrl, { method: 'POST', body: payload });
    const text = await response.text();
    const markerIndex = text.indexOf('/*DX*/'); if (markerIndex === -1) return failValues;

    const cleanJsonString = text.substring(text.indexOf('{', markerIndex), text.lastIndexOf('}') + 1);
    const outerData = Function('return ' + cleanJsonString)();
    if (!outerData?.result?.data) return failValues;

    const innerWidgets = Function('return ' + outerData.result.data)();
    let plan = '-', fact = '-', alloc = '-';
    
    if (Array.isArray(innerWidgets) && innerWidgets.length > 0) {
      if (innerWidgets.length >= 2) {
        fact = innerWidgets[0].Number1 !== undefined ? innerWidgets[0].Number1 : (innerWidgets[0].Text1 || '-');
        plan = innerWidgets[0].Number2 !== undefined ? innerWidgets[0].Number2 : (innerWidgets[0].Text2 || '-');
        alloc = innerWidgets[1].Number1 !== undefined ? innerWidgets[1].Number1 : (innerWidgets[1].Text1 || '-');
      } else {
        fact = innerWidgets[0].Number1 !== undefined ? innerWidgets[0].Number1 : (innerWidgets[0].Text1 || '-');
        plan = innerWidgets[0].Number2 !== undefined ? innerWidgets[0].Number2 : (innerWidgets[0].Text2 || '-');
      }
    }
    return { plan, fact, alloc };
  } catch (error) { return failValues; }
}
