const expressionDisplay = document.querySelector("#expression");
const resultDisplay = document.querySelector("#result");
const messageDisplay = document.querySelector("#message");
const historyList = document.querySelector("#history-list");
const historyCount = document.querySelector("#history-count");
const keypad = document.querySelector(".keypad");
const history = loadHistory();
let expression = "0";
let lastResult = 0;
let angleUnit = "DEG";
let justCalculated = false;

function loadHistory() {
  try {
    const saved = JSON.parse(localStorage.getItem("axis-calculator-history") || "[]");
    return Array.isArray(saved) ? saved.slice(0, 12) : [];
  } catch {
    return [];
  }
}

function saveHistory() {
  try {
    localStorage.setItem("axis-calculator-history", JSON.stringify(history));
  } catch {
    showMessage("History could not be saved");
  }
}

function render() {
  expressionDisplay.textContent = expression;
  expressionDisplay.title = expression;
  resultDisplay.textContent = formatNumber(lastResult);
}

function formatNumber(value) {
  if (!Number.isFinite(value)) return "Error";
  if (Object.is(value, -0)) return "0";
  const rounded = Number.parseFloat(value.toPrecision(12));
  return String(rounded);
}

function showMessage(text = "") {
  messageDisplay.textContent = text;
}

function append(value) {
  const startsNew = /^[0-9.]$/.test(value) || value === "pi" || value === "e" || /^[a-z]+\($/i.test(value) || value === "(";
  if (justCalculated && startsNew) expression = "0";
  justCalculated = false;
  showMessage("");
  if (expression === "0" && startsNew) expression = value;
  else expression += value;
  render();
}

function clear() {
  expression = "0";
  lastResult = 0;
  justCalculated = false;
  showMessage("");
  render();
}

function backspace() {
  justCalculated = false;
  showMessage("");
  expression = expression.length > 1 ? expression.slice(0, -1) : "0";
  if (expression === "") expression = "0";
  render();
}

function tokenize(source) {
  const tokens = [];
  const pattern = /\s*([0-9]+(?:\.[0-9]*)?|\.[0-9]+)(?:[eE][+-]?\d+)?|\s*([a-zA-Z]+)|\s*([()+\-*/%^!,])/y;
  let cursor = 0;
  while (cursor < source.length) {
    pattern.lastIndex = cursor;
    const match = pattern.exec(source);
    if (!match) throw new Error("Invalid character");
    tokens.push(match[1] || match[2]?.toLowerCase() || match[3]);
    cursor = pattern.lastIndex;
  }
  return tokens;
}

function evaluate(source) {
  const tokens = tokenize(source);
  let position = 0;
  const peek = () => tokens[position];
  const consume = () => tokens[position++];

  function parseExpression() {
    let value = parseTerm();
    while (peek() === "+" || peek() === "-") {
      const operator = consume();
      const right = parseTerm();
      value = operator === "+" ? value + right : value - right;
    }
    return value;
  }

  function parseTerm() {
    let value = parseUnary();
    while (["*", "/", "%"].includes(peek())) {
      const operator = consume();
      const right = parseUnary();
      if (operator === "*") value *= right;
      else if (operator === "/") value /= right;
      else value %= right;
    }
    return value;
  }

  function parseUnary() {
    if (peek() === "+") { consume(); return parseUnary(); }
    if (peek() === "-") { consume(); return -parseUnary(); }
    return parsePower();
  }

  function parsePower() {
    const base = parsePostfix();
    if (peek() === "^") {
      consume();
      return base ** parseUnary();
    }
    return base;
  }

  function parsePostfix() {
    let value = parsePrimary();
    while (peek() === "!") {
      consume();
      if (!Number.isInteger(value) || value < 0 || value > 170) throw new Error("Factorial needs an integer from 0 to 170");
      let factorial = 1;
      for (let number = 2; number <= value; number += 1) factorial *= number;
      value = factorial;
    }
    return value;
  }

  function parsePrimary() {
    const token = consume();
    if (token === undefined) throw new Error("Incomplete expression");
    if (token === "(") {
      const value = parseExpression();
      if (consume() !== ")") throw new Error("Missing closing parenthesis");
      return value;
    }
    if (/^(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i.test(token)) return Number(token);
    if (token === "pi") return Math.PI;
    if (token === "e") return Math.E;
    const functions = ["sin", "cos", "tan", "asin", "acos", "atan", "sqrt", "ln", "log", "abs"];
    if (functions.includes(token)) {
      if (consume() !== "(") throw new Error(`Expected ( after ${token}`);
      const argumentStart = position;
      const argument = parseExpression();
      const argumentEnd = position;
      if (consume() !== ")") throw new Error("Missing closing parenthesis");
      const argumentSource = tokens.slice(argumentStart, argumentEnd).join("");
      return applyFunction(token, argument, argumentSource);
    }
    throw new Error("Unknown value or function");
  }

  const value = parseExpression();
  if (position !== tokens.length) throw new Error("Check the expression");
  if (!Number.isFinite(value)) throw new Error("Result is undefined");
  return value;
}

function applyFunction(name, value, argumentSource = "") {
  const usesRadians = angleUnit === "RAD" || /pi/i.test(argumentSource);
  const radians = usesRadians ? value : value * Math.PI / 180;
  const fromRadians = (result) => angleUnit === "DEG" ? result * 180 / Math.PI : result;
  switch (name) {
    case "sin": return Math.sin(radians);
    case "cos": return Math.cos(radians);
    case "tan": return Math.tan(radians);
    case "asin": return fromRadians(Math.asin(value));
    case "acos": return fromRadians(Math.acos(value));
    case "atan": return fromRadians(Math.atan(value));
    case "sqrt": return Math.sqrt(value);
    case "ln": return Math.log(value);
    case "log": return Math.log10(value);
    case "abs": return Math.abs(value);
    default: throw new Error("Unknown function");
  }
}

function calculate() {
  try {
    const value = evaluate(expression);
    lastResult = value;
    justCalculated = true;
    showMessage("");
    history.unshift({ expression, result: formatNumber(value) });
    history.splice(12);
    saveHistory();
    renderHistory();
    render();
  } catch (error) {
    showMessage(error.message || "Check the expression");
  }
}

function renderHistory() {
  historyCount.textContent = String(history.length);
  historyList.replaceChildren();
  if (history.length === 0) {
    const empty = document.createElement("div");
    empty.className = "history-empty";
    empty.innerHTML = '<span class="empty-mark" aria-hidden="true">∑</span><p>No calculations yet</p><span>Your results will appear here.</span>';
    historyList.append(empty);
    return;
  }
  for (const item of history) {
    const row = document.createElement("button");
    row.className = "history-item";
    row.type = "button";
    row.setAttribute("aria-label", `${item.expression} equals ${item.result}; load expression`);
    const original = document.createElement("span");
    original.className = "history-expression";
    original.textContent = item.expression;
    const result = document.createElement("p");
    result.className = "history-result";
    result.textContent = `= ${item.result}`;
    row.append(original, result);
    row.addEventListener("click", () => {
      expression = item.expression;
      lastResult = Number(item.result);
      justCalculated = false;
      showMessage("");
      render();
    });
    historyList.append(row);
  }
}

keypad.addEventListener("click", (event) => {
  const button = event.target.closest("button");
  if (!button) return;
  if (button.dataset.action === "clear") clear();
  else if (button.dataset.action === "backspace") backspace();
  else if (button.dataset.action === "calculate") calculate();
  else if (button.dataset.insert) append(button.dataset.insert);
});

document.querySelectorAll("[data-angle]").forEach((button) => {
  button.addEventListener("click", () => {
    angleUnit = button.dataset.angle;
    document.querySelectorAll("[data-angle]").forEach((option) => {
      const active = option === button;
      option.classList.toggle("is-active", active);
      option.setAttribute("aria-pressed", String(active));
    });
    showMessage("");
  });
});

document.querySelector(".clear-history").addEventListener("click", () => {
  history.splice(0);
  saveHistory();
  renderHistory();
});

document.querySelector(".copy-button").addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText(formatNumber(lastResult));
    showMessage("Result copied");
  } catch {
    showMessage("Clipboard unavailable");
  }
});

document.addEventListener("keydown", (event) => {
  if (event.ctrlKey || event.metaKey || event.altKey) return;
  if (/^[0-9.]$/.test(event.key) || /^[()+\-*/%^!]$/.test(event.key)) {
    event.preventDefault();
    append(event.key);
  } else if (event.key === "Enter" || event.key === "=") {
    event.preventDefault();
    calculate();
  } else if (event.key === "Backspace") {
    event.preventDefault();
    backspace();
  } else if (event.key === "Escape") {
    clear();
  }
});

render();
renderHistory();