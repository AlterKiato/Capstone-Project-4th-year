/* eslint-disable @typescript-eslint/no-require-imports */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { FEEDBACK_PREFIX, encodeFeedback, decodeFeedback, feedbackPlainText, validateFeedback, feedbackCommentsSchema } = require('../lib/utils/feedback-content.ts');
const { createFeedbackSchema } = require('../lib/validations/feedback.ts');
const rich = { version: 1, blocks: [
    { type: 'paragraph', content: [{ text: 'Clear ', bold: true }, { text: 'synthetic ', italic: true }, { text: 'feedback', underline: true }] },
    { type: 'bulletList', items: [[{ text: 'First revision', bold: true }], [{ text: 'Second revision' }]] },
    { type: 'numberList', items: [[{ text: 'Check references', italic: true }], [{ text: 'Check methods', underline: true }]] },
    { type: 'paragraph', content: [{ text: 'Final paragraph' }] },
] };
test('five formatting features and mixed paragraphs/lists survive string serialization', () => {
    const encoded = encodeFeedback(rich);
    assert.ok(encoded.startsWith(FEEDBACK_PREFIX)); assert.deepEqual(decodeFeedback(encoded), rich);
    assert.equal(validateFeedback(encoded), null);
    assert.equal(feedbackPlainText(encoded), 'Clear synthetic feedback\nFirst revision\nSecond revision\nCheck references\nCheck methods\nFinal paragraph');
    assert.equal(createFeedbackSchema.parse({ submissionId: '1', comments: encoded, decision: 'Approved' }).comments, encoded);
});
test('historical Markdown, HTML and JSON remain exact literal text; no format guessing', () => {
    for (const plain of ['**legacy** _literal_ <u>literal</u>', '{"version":1,"blocks":[]}', '<script>alert(1)</script>', '  Old comment\nnext line  ']) {
        assert.equal(feedbackPlainText(plain), plain); assert.ok(decodeFeedback(plain));
    }
    assert.equal(feedbackCommentsSchema.parse('  Legacy  '), 'Legacy');
});
test('meaningful visible-text validation rejects blank formatting and empty list items', () => {
    for (const blocks of [[], [{ type: 'paragraph', content: [{ text: '  \n ', bold: true }] }], [{ type: 'bulletList', items: [[], [{ text: '\t ' }]] }]]) {
        assert.match(validateFeedback(FEEDBACK_PREFIX + JSON.stringify({ version: 1, blocks })), /required/);
    }
});
test('5000 UTF-16 visible characters accepted independently of markup overhead', () => {
    const content = Array.from({length: 5000}, (_, index) => ({text: 'x', bold: index % 2 === 0}));
    const encoded = encodeFeedback({ version: 1, blocks: [{type:'paragraph',content}] });
    assert.ok(encoded.length > 5000); assert.equal(validateFeedback(encoded), null);
    assert.match(validateFeedback('x'.repeat(5001)), /5000/);
    assert.equal(validateFeedback('😀'.repeat(2500)), null); assert.match(validateFeedback('😀'.repeat(2501)), /5000/);
    assert.match(validateFeedback('x'.repeat(4998)+'\r\n'+'y'),/5000/);
    assert.match(validateFeedback(encodeFeedback({version:1,blocks:[{type:'paragraph',content:[{text:'x'.repeat(5001),bold:true}]}]})),/5000/);
});
test('server rejects malformed, unknown, nested, attributed and oversized representations', () => {
    const payloads = [
        '{', JSON.stringify({...rich, script:'alert(1)'}), JSON.stringify({...rich, version:2}),
        JSON.stringify({version:1,blocks:[{type:'image',src:'x'}]}),
        JSON.stringify({version:1,blocks:[{type:'paragraph',content:[{text:'x',href:'javascript:alert(1)'}]}]}),
        JSON.stringify({version:1,blocks:[{type:'bulletList',items:[[{type:'bulletList',items:[]}]]}]}),
        JSON.stringify({version:1,blocks:Array.from({length:257},()=>({type:'paragraph',content:[]}))}),
        'x'.repeat(524289),
    ];
    for (const payload of payloads) {
        const input = FEEDBACK_PREFIX + payload;
        assert.notEqual(validateFeedback(input), null); assert.equal(feedbackCommentsSchema.safeParse(input).success, false);
    }
    assert.equal(feedbackCommentsSchema.safeParse('\u001eTHESISHS_FEEDBACK:2\n{}').success, false);
});
test('valid malicious-looking text is data, never interpreted as HTML/URLs', () => {
    const text = '<img src=x onerror=alert(1)><script>alert(2)</script> javascript:alert(3)';
    const encoded = encodeFeedback({version:1,blocks:[{type:'paragraph',content:[{text,bold:true}]}]});
    assert.equal(validateFeedback(encoded), null); assert.equal(feedbackPlainText(encoded), text);
    const reservedLiteral = '\n' + FEEDBACK_PREFIX + '<script>alert(1)</script>';
    assert.equal(feedbackPlainText(feedbackCommentsSchema.parse(reservedLiteral)), reservedLiteral.trim());
});
