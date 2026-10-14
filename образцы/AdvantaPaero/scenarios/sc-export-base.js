import { parseActiveParentMetadata, parseDomStructureIntoMap, generateAndDownloadCsvFile } from '../utils/data-helpers.js';
import { fetchHoursViaDMPacket } from '../utils/net-helpers.js';

export async function run() {
  const localMemoryMap = new Map();
  const vsKey = document.getElementById('__VIEWSTATE_KEY')?.value;
  const ctrlKey = document.getElementById('__CONTROLLER_KEY')?.value;
  const fileName = 'PROCENTR_BASE_STRUCTURE.csv';

  const pUid = parseActiveParentMetadata(localMemoryMap);
  const pHours = await fetchHoursViaDMPacket(pUid, window.location.href, vsKey, ctrlKey);
  
  const parentObj = localMemoryMap.get(pUid);
  parentObj.planHours = pHours.plan; parentObj.factHours = pHours.fact; parentObj.allocatedHours = pHours.alloc;
  
  parseDomStructureIntoMap(localMemoryMap);
  generateAndDownloadCsvFile(localMemoryMap, fileName);
}
