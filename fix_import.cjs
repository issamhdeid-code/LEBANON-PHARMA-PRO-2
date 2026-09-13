const fs = require('fs');
let code = fs.readFileSync('src/components/purchase/PurchaseView.tsx', 'utf-8');
code = code.replace('import { motion } from "motion/react";import React', 'import { motion } from "motion/react";\nimport React');
fs.writeFileSync('src/components/purchase/PurchaseView.tsx', code);
