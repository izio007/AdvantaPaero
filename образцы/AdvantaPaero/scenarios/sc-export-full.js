import { parseActiveParentMetadata, parseDomStructureIntoMap, generateAndDownloadCsvFile } from '../utils/data-helpers.js';
import { fetchHoursViaDMPacket } from '../utils/net-helpers.js';

export async function run() {
  const localMemoryMap = new Map();
  const vsKey = document.getElementById('__VIEWSTATE_KEY')?.value;
  const ctrlKey = document.getElementById('__CONTROLLER_KEY')?.value;
  const fileName = 'PROCENTR_TOTAL_REPORT.csv';
  const networkThrottleDelay = 750;

  parseActiveParentMetadata(localMemoryMap);
  parseDomStructureIntoMap(localMemoryMap);

  const keys = Array.from(localMemoryMap.keys());
  for (let i = 0; i < keys.length; i++) {
    const uid = keys[i];
    const project = localMemoryMap.get(uid);
    const hours = await fetchHoursViaDMPacket(uid, project.link, vsKey, ctrlKey);
    
    project.planHours = hours.plan; project.factHours = hours.fact; project.allocatedHours = hours.alloc;
    await new Promise(r => setTimeout(r, networkThrottleDelay));
  }

  generateAndDownloadCsvFile(localMemoryMap, fileName);
}
