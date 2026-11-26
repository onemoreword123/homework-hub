import asyncio, json
from playwright.async_api import async_playwright
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path="/usr/bin/google-chrome")
        ctx = await b.new_context(viewport={"width":1100,"height":900})
        await ctx.add_init_script(path="/home/claude/hubtest/mock.js")
        pg = await ctx.new_page(); errs=[]; pg.on("pageerror", lambda e: errs.append(str(e)))
        await pg.goto("http://localhost:8765/index.html")
        await pg.evaluate("localStorage.setItem('mockuser','T')")
        await pg.goto("http://localhost:8765/teacher.html"); await pg.wait_for_selector("#classbar button")
        await pg.click("#classbar button:has-text('Oi09')"); await pg.click("#tabs [data-tab=topics]")
        await pg.wait_for_selector("[data-preview=a2-interrupt]"); await pg.click("[data-preview=a2-interrupt]")
        await pg.wait_for_selector(".scorebar"); print("preview score:", await pg.inner_text(".scorebar .big"))
        print("wrong marks:", await pg.locator("#dbody .bad, #dbody label.wrong").count())
        await pg.screenshot(path="/home/claude/p2.png", full_page=False)
        print("errors:", errs); await b.close()
asyncio.run(main())
