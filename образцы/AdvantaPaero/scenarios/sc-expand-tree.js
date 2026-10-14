import { expandAllNodesRecursive } from '../utils/tree-helpers.js';

export async function run() {
  const scrollWrapperSelector = '[class*="_projectsListWrapper_"]';
  const plusImgSelector = 'img._switchImage_nz6me_8';
  
  await expandAllNodesRecursive(scrollWrapperSelector, plusImgSelector);
}
