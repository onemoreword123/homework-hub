import asyncio, json
from playwright.async_api import async_playwright
B="http://localhost:8765/"
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path="/usr/bin/google-chrome")
        ctx = await b.new_context(viewport={"width":1100,"height":900})
        await ctx.add_init_script(path="/home/claude/hubtest/mock2.js")
        async def priv(route): await route.fulfill(path="/home/claude/private/"+route.request.url.split("/__private/")[1], content_type="application/json")
        await ctx.route("**/__private/**", priv)
        pg = await ctx.new_page(); errs=[]; pg.on("pageerror", lambda e: errs.append(str(e)))
        pg.on("dialog", lambda d: asyncio.ensure_future(d.accept()))
        L=json.load(open("/home/claude/private/ielts-trumponomics.json"))
        await pg.goto(B+"index.html"); await pg.evaluate("localStorage.clear(); localStorage.setItem('mockuser','S2')")
        await pg.goto(B+"reading.html#ielts-trumponomics"); await pg.wait_for_selector("#c1 .opt")
        c1=L["chunks"][0]
        for j,q in enumerate(c1["comp"]):
            pick = q["a"] if j<3 else (q["a"]+1)%len(q["o"])
            await pg.click(f"#c1 .q >> nth={j} >> .opt >> nth={pick}")
        print("explanations before submit:", await pg.locator("#c1 .explain.show").count(), "| model buttons visible:", await pg.locator("#c1 .modelbtn:visible").count())
        for j,it in enumerate(c1["gap"]["items"]):
            await pg.fill(f"[data-save=c1-g{j}]", it[1][0] if j!=2 else "wrong")
        await pg.fill("[data-save=c1-t0]", "His unorthodox policy failed to deliver prosperity.")
        await pg.fill("[data-save=c1-w0]", "Trump promised a lot but many workers lost out.")
        await pg.locator("#c1-bar").scroll_into_view_if_needed(); await pg.screenshot(path="/home/claude/sec_before.png")
        await pg.click("#c1-bar [data-secsubmit]"); await pg.wait_for_selector("#c1-bar.done")
        print("after submit: explanations", await pg.locator("#c1 .explain.show").count(), "| models shown", await pg.locator("#c1 .model.show").count(), "| bar:", (await pg.inner_text("#c1-bar")).replace("\n"," ")[:90])
        print("c1 readonly:", await pg.get_attribute("[data-save=c1-t0]","readonly") is not None, "| c2 editable:", await pg.get_attribute("[data-save=c2-t0]","readonly") is None)
        await pg.screenshot(path="/home/claude/sec_after.png")
        await pg.locator("#c1 .step >> nth=1").scroll_into_view_if_needed(); await pg.screenshot(path="/home/claude/sec_mcq.png")
        await pg.wait_for_timeout(500)
        await pg.evaluate("Object.keys(localStorage).filter(k=>k.startsWith('hh.lab')).forEach(k=>localStorage.removeItem(k))")
        await pg.reload(); await pg.wait_for_selector("#c1 .opt")
        print("after reload c1 done:", await pg.locator("#c1.done").count(), "| dock:", await pg.inner_text("#dock .prog"))
        # teacher reopens section 1
        await pg.evaluate("localStorage.setItem('mockuser','T'); localStorage.setItem('hh.class','C3')")
        await pg.goto(B+"teacher.html"); await pg.wait_for_selector(".cell[data-st]")
        print("teacher cell:", await pg.inner_text(".cell[data-st]"))
        await pg.click(".cell[data-st]"); await pg.wait_for_selector("[data-reopen=c1]")
        await pg.screenshot(path="/home/claude/sec_teacher.png")
        await pg.click("[data-reopen=c1]"); await pg.wait_for_timeout(500)
        await pg.evaluate("localStorage.setItem('mockuser','S2')")
        await pg.goto(B+"reading.html#ielts-trumponomics"); await pg.wait_for_selector("#c1 .opt")
        print("after reopen c1 done:", await pg.locator("#c1.done").count(), "| answers kept:", await pg.input_value("[data-save=c1-t0]"))
        # submit everything
        for ch in [c["id"] for c in L["chunks"]]+["final"]:
            await pg.locator(f"#{ch}-bar [data-secsubmit]").scroll_into_view_if_needed()
            await pg.click(f"#{ch}-bar [data-secsubmit]"); await pg.wait_for_timeout(300)
        await pg.wait_for_selector(".banner.ok", timeout=8000)
        print("finished:", (await pg.inner_text(".banner.ok"))[:110])
        await pg.evaluate("localStorage.setItem('mockuser','T')")
        await pg.goto(B+"teacher.html"); await pg.wait_for_selector(".cell[data-st]")
        print("teacher cell at end:", await pg.inner_text(".cell[data-st]"))
        print("errors:", errs); await b.close()
asyncio.run(main())
