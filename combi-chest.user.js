// ==UserScript==
// @name         Christmas CombiChest Helper
// @namespace    https://github.com/IchKannNichts/torn-chest-helper
// @version      1.5.7
// @description  Adds a top‑most “Reset” button that clears all selections. The Reset button shares the initial background colour of the nine number buttons and retains it permanently.
// @author       Kochaff3
// @match        https://www.torn.com/*
// @grant        GM_xmlhttpRequest
// @grant        GM_addStyle
// @run-at       document-end
// ==/UserScript==

(() => {
    /* --------------------------- Configuration --------------------------- */
    const MAX_STATE   = 4;                 // 0 = default (no forced colour), 1 = Yellow, 2 = Green, 3 = Red, 4 → back to 0
    const REQUIRED    = 3;                 // Minimum number of (Yellow/Green) selections required
    const COLORS = {
        0: '',          // after reset: no explicit background colour (default button style)
        1: 'yellow',    // Yellow = present, wrong column
        2: 'lime',      // Green  = present, correct column
        3: 'red'        // Red    = not present
    };

    /* --------------------------- Helper Functions --------------------------- */
    const createEl = (tag, props = {}, children = []) => {
        const el = document.createElement(tag);
        Object.entries(props).forEach(([k, v]) => {
            if (k === 'style') Object.assign(el.style, v);
            else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
            else el[k] = v;
        });
        children.forEach(c => el.appendChild(
            typeof c === 'string' ? document.createTextNode(c) : c
        ));
        return el;
    };

    /** Column index of a number (0 = first column, 1 = second, 2 = third) */
    const columnOf = n => (n - 1) % 3;

    /** Returns true if a candidate triple satisfies all current clues */
    const candidateFits = (cand) => {
        for (let num = 1; num <= 9; num++) {
            const clue = state[num];               // 0 = unknown, 1 = Yellow, 2 = Green, 3 = Red
            if (clue === 0) continue;             // no info → always ok

            const idx = cand.indexOf(num);         // position inside candidate (0‑2) or -1 if absent
            const col = columnOf(num);             // original column of the number

            if (clue === 3) {                     // Red → must NOT appear
                if (idx !== -1) return false;
            } else if (clue === 2) {              // Green → must be in its original column
                if (idx !== col) return false;
            } else if (clue === 1) {              // Yellow → must appear, but NOT in its original column
                if (idx === -1) return false;          // must be present
                if (idx === col) return false;          // cannot be in same column
            }
        }
        return true;
    };

    /** Generate all ordered triples (3‑number combinations) that satisfy the clues */
    const calculatePossibleCombos = () => {
        const numbers = [...Array(9).keys()].map(i => i + 1); // [1..9]
        const combos = [];

        for (let i = 0; i < numbers.length; i++) {
            for (let j = 0; j < numbers.length; j++) {
                if (j === i) continue;
                for (let k = 0; k < numbers.length; k++) {
                    if (k === i || k === j) continue;
                    const cand = [numbers[i], numbers[j], numbers[k]];
                    if (candidateFits(cand)) combos.push(cand);
                }
            }
        }
        return combos;
    };

    /** Refresh the result area – only show when combos exist */
    const updateResult = () => {
        // Result text should always stay white
        resultDiv.style.color = 'white';

        const chosenCount = Object.values(state).filter(c => c === 1 || c === 2).length;
        if (chosenCount < REQUIRED) {
            // Not enough selections → clear the result area
            resultDiv.innerHTML = '';
            return;
        }

        const combos = calculatePossibleCombos();

        if (combos.length === 0) {
            resultDiv.textContent = 'No possible combination found – please review your hints (there may be a contradiction).';
            return;
        }

        // Show the list of possible combinations
        const html = combos.map(c => `[${c.join(', ')}]`).join('<br>');
        resultDiv.innerHTML = `<strong>Possible combinations (${combos.length}):</strong><br>${html}`;
    };

    /* --------------------------- State Management --------------------------- */
    const state = {};
    for (let i = 1; i <= 9; i++) state[i] = 0;   // start with default (0)

    /* --------------------------- UI Construction --------------------------- */
    const container = createEl('div', {
        style: {
            position: 'fixed',
            top: '100px',
            right: '40px',
            background: '#222 !important',
            color: '#fff',
            padding: '15px',
            borderRadius: '8px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.6)',
            zIndex: 9999,
            fontFamily: 'Arial,Helvetica,sans-serif',
            maxWidth: '340px',
            lineHeight: '1.4',
            textAlign: 'center'               // centre‑align all text inside the panel
        }
    });

    // -----------------------------------------------------------------
    // GLOBAL RESET BUTTON (top of the panel)
    // -----------------------------------------------------------------
    const globalResetBtn = createEl('button', {
        textContent: 'Reset',
        style: {
            width: '100%',
            marginBottom: '10px',
            padding: '6px 0',
            background: 'transparent',   // same background as the nine buttons have initially
            color: '#fff',                // white text as requested
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            fontWeight: 'bold',
            fontSize: '14px',
            transition: 'background 0.2s'
        },
        onclick: () => {
            // Reset **all** nine number buttons and the internal state
            for (let i = 1; i <= 9; i++) {
                state[i] = 0;
                const btn = buttonMap[i];
                btn.style.background = COLORS[0];   // remove any background colour
                btn.style.color = '';               // revert label colour to default page colour
            }
            // Clear the result area as well
            resultDiv.innerHTML = '';
        }
    });
    container.appendChild(globalResetBtn);
    // -----------------------------------------------------------------

    // ---- Requirement notice (must pick at least 3 colours) ----
    const requirementNotice = createEl('div', {
        style: { marginBottom: '13px', fontWeight: 'bold' },
        textContent: `Select at least ${REQUIRED} numbers (yellow or green) to get suggestions.`
    });

    const placeHolder = createEl('div', {
        style: { marginBottom: '13px', fontWeight: 'bold' },
        textContent: `________________________________________________`
    });

    // ---- 1‑to‑4 click explanation (centered) ----
    const clickInfo = createEl('div', {
        style: { marginBottom: '8px', fontSize: '90%' },
        innerHTML: `
            1‑click = Yellow (wrong column)<br>
            2‑click = Green (correct column)<br>
            3‑click = Red (not present)<br>
            4‑click = Reset (returns to default style)`
    });

    const grid = createEl('div', {
        style: {
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 45px)',
            gap: '5px',
            justifyContent: 'center',
            marginBottom: '10px'
        }
    });

    // Keep a reference to each button so the global reset can address them easily
    const buttonMap = {};

    // ---------- Create the 9 number buttons ----------
    for (let i = 1; i <= 9; i++) {
        const btn = createEl('button', {
            textContent: i,
            // No explicit background colour – the button shows the site’s default style
            style: {
                width: '45px',
                height: '45px',
                fontSize: '16px',
                cursor: 'pointer',
                borderRadius: '4px',
                border: '1px solid #555',
                transition: 'background 0.2s, color 0.2s'
            },
            onclick: () => {
                // Cycle: 0 → 1 → 2 → 3 → 0 (reset)
                state[i] = (state[i] + 1) % MAX_STATE;
                btn.style.background = COLORS[state[i]];

                // Dynamic label colour: black when the button has a colour, default otherwise
                if (state[i] === 0) {
                    btn.style.color = '';          // remove inline colour → default page colour
                } else {
                    btn.style.color = 'black';
                }

                updateResult();
            }
        });
        buttonMap[i] = btn;          // store reference for the global reset
        grid.appendChild(btn);
    }

    // Result area – starts empty, colour forced to white inside updateResult()
    const resultDiv = createEl('div', {
        style: {
            marginTop: '8px',
            fontWeight: 'bold',
            maxHeight: '250px',
            overflowY: 'auto',
            color: 'white'          // initial colour (will stay white)
        },
        innerHTML: ''               // keep empty until we have combos
    });

    // Assemble remaining elements
    container.appendChild(requirementNotice);
    container.appendChild(placeHolder);
    container.appendChild(clickInfo);
    container.appendChild(grid);
    container.appendChild(resultDiv);
    document.body.appendChild(container);
})();
