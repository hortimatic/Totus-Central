// Follow the same navigation as a user before activating a relocated control.
export async function chatAction(page,action){
 const control=page.locator('[data-chat="'+action+'"]').first();
 await chatClick(page,control);
}
export async function chatClick(page,control){
 const summary=await control.evaluate(el=>el.closest('details[data-chat-menu]')?.querySelector('summary')?.id||'');
 if(summary&&!await control.isVisible())await page.locator('#'+summary).click();
 await control.click();
}
export async function revealChatFilters(page){
 const box=page.locator('[data-chat-input=archived]');
 if(!await box.isVisible())await page.locator('.chat-browser-options>summary').click();
}
export async function revealChatSearch(page){
 if(!await page.locator('#chatQuery').isVisible())await chatAction(page,'search-toggle');
}
