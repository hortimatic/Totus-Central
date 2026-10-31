export async function openNavigation(page){
 const sidebar=page.locator('.sidebar');
 if(await sidebar.evaluate(el=>el.inert))await page.locator('[data-action="toggle-menu"]').click();
}
export async function navigate(page,route){
 await openNavigation(page);await page.locator('#nav [data-route="'+route+'"]').click();
}
export async function clickModuleLink(page,link,options={}){
 await openNavigation(page);await link.click(options);
}
