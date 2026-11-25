import asyncio
from playwright.async_api import async_playwright
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path="/usr/bin/google-chrome")
        ctx = await b.new_context(viewport={"width":800,"height":900}); await ctx.add_init_script(path="/home/claude/hubtest/mock.js")
        pg = await ctx.new_page(); errs=[]; pg.on("pageerror", lambda e: errs.append(str(e)))
        await pg.goto("http://localhost:8765/index.html"); await pg.evaluate("localStorage.clear()"); await pg.goto("http://localhost:8765/index.html")
        await pg.evaluate("const d=JSON.parse(localStorage.getItem('mockdb'));d.class_topics.push({class_id:'C2',topic_id:'b1-process',opened_at:new Date().toISOString()});localStorage.setItem('mockdb',JSON.stringify(d));localStorage.setItem('mockuser','S1');localStorage.setItem('hh.wotd.S1', new Date().toLocaleDateString('en-CA',{timeZone:'Asia/Ho_Chi_Minh'}))")
        await pg.goto("http://localhost:8765/student.html#/t/b1-process"); await pg.wait_for_selector(".flow")
        await pg.locator(".flow").screenshot(path="/home/claude/flow.png"); await pg.goto("http://localhost:8765/student.html#/t/b1-process"); await pg.wait_for_timeout(1500); await pg.get_by_role("button", name="Lesson").first.click() if await pg.get_by_role("button", name="Lesson").count() else None; await pg.wait_for_timeout(800); await pg.locator(".lesson-fig").first.scroll_into_view_if_needed() if await pg.locator(".lesson-fig").count() else None; await pg.screenshot(path="/home/claude/fig.png"); print([await t.inner_text() for t in await pg.locator(".tabs button, .tabs a").all()]); print("figs", await pg.locator(".lesson-fig").count(), "lis", await pg.locator(".flow-step li").count())
        print("errors:", errs); await b.close()
asyncio.run(main())
