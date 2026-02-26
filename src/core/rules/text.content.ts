import type { Finding } from "../types";
import { getPageName } from "../scanner";

const PLACEHOLDER_PATTERNS = [
  /lorem ipsum/i,
  /dolor sit amet/i,
  /placeholder/i,
  /\[.*?\]/,  // [Placeholder text]
  /{{.*?}}/,  // {{placeholder}}
  /sample text/i,
  /your text here/i,
  /text goes here/i,
  /content here/i,
  /^(text|label|title|heading|description)$/i,  // Generic labels
  /^(xxx|yyy|zzz|aaa|bbb)+$/i  // Repeated characters
];

const TOKEN_PATTERNS = [
  /eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/,  // JWT tokens
  /sk_live_[A-Za-z0-9]{20,}/,  // Stripe keys
  /pk_live_[A-Za-z0-9]{20,}/,  // Stripe public keys
  /AIza[A-Za-z0-9_-]{35}/,  // Google API keys
  /[A-Za-z0-9]{32,}/  // Generic long tokens (32+ chars, no spaces)
];

const URL_PATTERNS = [
  /https?:\/\//i,
  /www\./i,
  /localhost:\d+/i,
  /127\.0\.0\.1/i,
  /192\.168\./i
];

function isTextNode(node: SceneNode): node is TextNode {
  return node.type === "TEXT";
}

function containsPlaceholder(text: string): boolean {
  return PLACEHOLDER_PATTERNS.some(pattern => pattern.test(text));
}

function containsToken(text: string): boolean {
  // Skip if text is too short to be a token
  if (text.length < 20) return false;
  return TOKEN_PATTERNS.some(pattern => pattern.test(text));
}

function containsURL(text: string): boolean {
  return URL_PATTERNS.some(pattern => pattern.test(text));
}

function isOverlyLong(text: string, maxLength = 500): boolean {
  return text.length > maxLength;
}

export async function checkTextContent(
  nodes: SceneNode[]
): Promise<Finding[]> {
  const findings: Finding[] = [];

  for (const node of nodes) {
    if (!isTextNode(node)) continue;

    const text = node.characters;
    if (!text || text.trim().length === 0) continue;

    // Check for placeholder text
    if (containsPlaceholder(text)) {
      findings.push({
        id: `${node.id}-placeholder`,
        principle: "Truth",
        severity: "warn",
        ruleId: "text.placeholder",
        nodeId: node.id,
        nodeName: node.name,
        pageName: getPageName(node),
        message: "Text contains placeholder content",
        howToFix: `Replace placeholder text with actual content: "${text.substring(0, 50)}${text.length > 50 ? '...' : ''}"`,
        canAutoFix: false
      });
    }

    // Check for hardcoded tokens
    if (containsToken(text)) {
      findings.push({
        id: `${node.id}-token`,
        principle: "Function",
        severity: "block",
        ruleId: "text.token",
        nodeId: node.id,
        nodeName: node.name,
        pageName: getPageName(node),
        message: "Text contains what appears to be a security token or API key",
        howToFix: "Remove sensitive tokens/keys from design files. Use placeholder text instead.",
        canAutoFix: false
      });
    }

    // Check for hardcoded URLs
    if (containsURL(text)) {
      findings.push({
        id: `${node.id}-url`,
        principle: "Truth",
        severity: "info",
        ruleId: "text.url",
        nodeId: node.id,
        nodeName: node.name,
        pageName: getPageName(node),
        message: "Text contains hardcoded URL",
        howToFix: `Consider if this URL should be parameterized: "${text.substring(0, 50)}${text.length > 50 ? '...' : ''}"`,
        canAutoFix: false
      });
    }

    // Check for overly long text
    if (isOverlyLong(text)) {
      findings.push({
        id: `${node.id}-long-text`,
        principle: "Clarity",
        severity: "info",
        ruleId: "text.length",
        nodeId: node.id,
        nodeName: node.name,
        pageName: getPageName(node),
        message: `Text is very long (${text.length} characters) and may cause overflow`,
        howToFix: "Consider breaking text into multiple text nodes or using a shorter example",
        canAutoFix: false
      });
    }
  }

  return findings;
}
