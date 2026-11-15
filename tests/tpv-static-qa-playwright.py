"""Playwright: actual Totus TPV UI on GitHub Pages-style subpath.
HTTP backend is mocked ONLY for safe UI contract checks; a separate smoke
runs against the real deployed Supabase function without credentials.
"""
from pathlib import Path
import json
from playwright.sync_api import sync_playwright, expect
BASE="http://127.0.0.1:8766"
STATIC="/Totus-Central/assets/tpv-qa/"
ART=Path("artifacts/tpv-pages")
ART.mkdir(parents=True,exist_ok=True)
jwt="a"*80
events=[]
with sync_playwright() as p:
 browser=p.chromium.launch(headless=True,args=["--no-sandbox"])
 page=browser.new_page(viewport={"width":1440,"height":900})
 def route(request):
  req=request.request
  url=req.url
  if req.method=="OPTIONS" and "ltwfmhilbvpzqdgjhvjb.supabase.co" in url:
   return request.fulfill(status=204,headers={
    "access-control-allow-origin":"http://127.0.0.1:8766",
    "access-control-allow-headers":"authorization,apikey,content-type",
    "access-control-allow-methods":"GET,POST,OPTIONS"})
  if "ltwfmhilbvpzqdgjhvjb.supabase.co/auth/v1/token" in url:
   events.append("auth")
   return request.fulfill(status=200,content_type="application/json",
    headers={"access-control-allow-origin":"*"},
    body=json.dumps({"access_token":jwt}))
  if "ltwfmhilbvpzqdgjhvjb.supabase.co/functions/v1/tpv-pages-api" in url:
   from urllib.parse import urlparse,parse_qs
   op=parse_qs(urlparse(url).query).get("op",["status"])[0]
   assert req.headers.get("authorization")=="Bearer "+jwt
   events.append(op)
   if op=="operator":
    answer={"authorized":True,"orderWriteEnabled":False,"operatorRole":"administrador"}
   elif op=="status":
    answer={"schema":"totus-tpv-multi-store-v1","defaultStore":"hortimatic",
      "stores":[{"id":"hortimatic","name":"Hortimatic","connected":True,
       "checkoutReady":False,"drawers":["h-vape","h-head"],
       "paymentMethods":[],"reason":"API_ONLY_CHECKOUT_NOT_VALIDATED"},
       {"id":"newoldsmok","name":"NewOldSmok","connected":False,
        "checkoutReady":False,"drawers":[],"paymentMethods":[]}]}
   elif op=="qa":
    answer={"qaEnabled":False,"commercialSalesEnabled":False,
      "mode":"preproduction-only","paymentMethods":[]}
   elif op=="catalog":
    answer={"source":"REAL_PS8_READ_ONLY","hasMore":False,"items":[{
      "id_product":1003030,"active":True,"name":"QA Producto",
      "reference":"QA","variants":[{"id_product_attribute":5,
       "reference":"QA5","stock_quantity":3,"stock_row_unique":True}]}]}
   elif op=="price":
    answer={"source":"PS8_NATIVE_PRICE_CALCULATION","productId":1003030,
      "variantId":5,"quantity":1,"unitTaxIncl":8.01,"safeToSell":False}
   else:
    raise AssertionError("unexpected private operation "+op)
   return request.fulfill(status=200,content_type="application/json",
    headers={"access-control-allow-origin":"*"},body=json.dumps(answer))
  return request.continue_()
 page.route("**/*",route)
 response=page.goto(BASE+STATIC,wait_until="domcontentloaded")
 assert response and response.status==200
 expect(page.locator("#btn-cobrar-finalizar")).to_be_disabled()
 expect(page.locator("#tpv-session-bar")).to_contain_text("Inicia sesión")
 assert "catalog" not in events, "Private catalog accessed without login"
 page.get_by_role("button",name="Acceso operador").click()
 dialog=page.locator("dialog")
 dialog.locator("input[name=email]").fill("qa@example.invalid")
 dialog.locator("input[name=password]").fill("local-only")
 dialog.get_by_role("button",name="Entrar").click()
 expect(page.get_by_role("button",name="Cerrar sesión")).to_be_visible(timeout=8000)
 expect(page.locator("button[data-key='1003030:5']")).to_be_visible(timeout=8000)
 page.locator("button[data-key='1003030:5']").click()
 expect(page.locator("#display-total-amount")).to_contain_text("8,01",timeout=6000)
 expect(page.locator("#btn-cobrar-finalizar")).to_be_disabled()
 assert all(op in events for op in ("auth","operator","status","catalog","price"))
 assert not any(op in events for op in ("checkout","history"))
 page.screenshot(path=str(ART/"pages-login-catalog.png"),full_page=True)
 browser.close()
print("PASS: GitHub Pages path, real Chromium UI, Supabase Auth/JWT API contract, product and price, write disabled")
