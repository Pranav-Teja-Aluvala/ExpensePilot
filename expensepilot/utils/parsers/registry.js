import { SBIParser } from './sbiParser.js';
import { HDFCParser } from './hdfcParser.js';
import { ICICIParser } from './iciciParser.js';
import { AxisParser } from './axisParser.js';
import { KotakParser } from './kotakParser.js';
import { UnionParser } from './unionParser.js';

const ALL_PARSERS = [
  new SBIParser(),
  new HDFCParser(),
  new ICICIParser(),
  new AxisParser(),
  new KotakParser(),
  new UnionParser(),
];

export function findParser(emailFrom, emailSubject) {
  return ALL_PARSERS.find(p => p.canParse(emailFrom, emailSubject)) || null;
}

export function parseEmail(emailFrom, emailSubject, emailBody, emailDate) {
  const parser = findParser(emailFrom, emailSubject);
  if (!parser) return null;
  try {
    return parser.parse(emailBody, emailSubject, emailDate);
  } catch (err) {
    console.error(`Error parsing with ${parser.name}:`, err);
    return null;
  }
}

export function getAllParsers() {
  return ALL_PARSERS;
}

export function getParserNames() {
  return ALL_PARSERS.map(p => p.name);
}
