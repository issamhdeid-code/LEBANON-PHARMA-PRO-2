const fs = require('fs');
let code = fs.readFileSync('src/components/purchase/PurchaseView.tsx', 'utf-8');

let count = 0;
code = code.replace(/<div( className="[^"]*resize overflow-auto[^"]*"[^>]*)>([\s\S]*?)<\/div>(?=\s*<(div|{))/g, (match, p1, p2, p3) => {
    // wait, this regex might match too much if there are nested divs.
    return match;
});

// A proper stack-based parser to replace tags:
let result = "";
let i = 0;
let stack = [];
let targetDivs = [];

const TARGET = 'resize overflow-auto';

while (i < code.length) {
    let nextOpen = code.indexOf('<div', i);
    let nextClose = code.indexOf('</div', i);
    
    if (nextOpen !== -1 && nextOpen < nextClose) {
        // found open
        let tagEnd = code.indexOf('>', nextOpen);
        let tag = code.substring(nextOpen, tagEnd + 1);
        
        if (tag.includes(TARGET)) {
            stack.push({ type: 'target', start: nextOpen, tag: tag, tagEnd: tagEnd });
            targetDivs.push({ start: nextOpen, end: -1, tag: tag, tagEnd: tagEnd });
        } else {
            stack.push({ type: 'normal' });
        }
        i = tagEnd + 1;
    } else if (nextClose !== -1) {
        // found close
        let popped = stack.pop();
        if (popped && popped.type === 'target') {
            // Find the corresponding item in targetDivs
            let target = targetDivs.find(t => t.start === popped.start);
            target.end = nextClose;
            target.closeTagEnd = code.indexOf('>', nextClose);
        }
        i = code.indexOf('>', nextClose) + 1;
    } else {
        break;
    }
}

// Now replace from back to front
for (let j = targetDivs.length - 1; j >= 0; j--) {
    let t = targetDivs[j];
    let newClose = '</motion.div>';
    let newOpen = '<motion.div drag dragMomentum={false} style={{ touchAction: "none" }}' + t.tag.substring(4);
    
    code = code.substring(0, t.end) + newClose + code.substring(t.closeTagEnd + 1);
    code = code.substring(0, t.start) + newOpen + code.substring(t.tagEnd + 1);
}

fs.writeFileSync('src/components/purchase/PurchaseView.tsx', code);
console.log('Replaced ' + targetDivs.length + ' divs');
