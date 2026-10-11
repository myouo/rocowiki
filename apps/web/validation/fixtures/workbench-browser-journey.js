async function runWorkbenchBrowserJourney(role) {
  const checks=[],pause=()=>new Promise(resolve=>setTimeout(resolve,250));
  function check(name,value){checks.push({name,pass:Boolean(value)});if(!value)throw Error(name);}
  async function click(label){const button=[...document.querySelectorAll('button')].find(node=>node.textContent.trim()===label||node.querySelector('b')?.textContent===label);if(!button||button.disabled)throw Error(`Button unavailable: ${label}`);button.click();await pause();}
  async function fill(selector,value){const node=document.querySelector(selector);if(!node)throw Error(`Missing field: ${selector}`);const proto=node.tagName==='TEXTAREA'?HTMLTextAreaElement.prototype:HTMLInputElement.prototype;Object.getOwnPropertyDescriptor(proto,'value').set.call(node,value);node.dispatchEvent(new Event('input',{bubbles:true}));await pause();}
  await pause();
  if(role==='contributor'){
    await click('加载当前基线');
    await fill('.markdown-editor','# Browser revised\n\n原生浏览器工作台交互验证。');
    await fill('input[placeholder*="至少 5"]','浏览器交互修订验证');
    await fill('[aria-label="来源 1 标题"]','测试来源');await fill('[aria-label="来源 1 地址"]','https://example.com/source');
    __workbenchFixture.loseNext='draft';await click('保存私有草稿');
    check('Draft timeout preserves the editor',document.body.textContent.includes('请求超时')&&document.querySelector('.markdown-editor').value.includes('Browser revised'));
    await click('保存私有草稿');
    const saved=__workbenchFixture.state.requests.filter(row=>row.path.startsWith('/drafts/')&&row.method==='PUT');
    check('Native browser draft retry keeps its ID',saved.length===2&&saved[0].path===saved[1].path&&Object.keys(__workbenchFixture.state.drafts).length===1);
    await click('我的草稿与投稿');await click('继续编辑');
    check('Native browser restores draft input',document.querySelector('.markdown-editor').value.includes('Browser revised'));
    __workbenchFixture.loseNext='submit';await click('提交审核');
    check('Submission timeout is visible',document.body.textContent.includes('请求超时'));
    await click('提交审核');
    const submitted=__workbenchFixture.state.requests.filter(row=>row.path==='/submissions'&&row.method==='POST');
    check('Native browser explicit retry keeps idempotency key',submitted.length===2&&submitted[0].key===submitted[1].key&&Object.keys(__workbenchFixture.state.submissions).length===1);
    check('Submission history is visible',document.body.textContent.includes('浏览器交互修订验证'));
  }else if(role==='reviewer'){
    await click('浏览器交互修订验证');
    check('Native browser shows reviewed diff',document.querySelector('.diff-panel')&&document.body.textContent.includes('投稿来源'));
    await fill('.review-panel textarea','已完成浏览器流程核验');await click('批准');
    check('Independent review updates status',Object.values(__workbenchFixture.state.submissions)[0].status==='approved'&&document.body.textContent.includes('已批准'));
  }else {
    check('Viewer cannot edit or review',!document.querySelector('.workspace textarea')&&![...document.querySelectorAll('.workspace [role="tab"]')].some(node=>node.textContent==='审核队列'));
  }
  return {role,checks};
}
