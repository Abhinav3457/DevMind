import { describe, it, expect } from 'vitest';
import { detectCodeLanguage, fileForLanguage, getLanguage } from '../codeLanguage';

const CPP = `#include <iostream>
#include <vector>

class Stack {
public:
  void push(int value) { items.push_back(value); }
private:
  std::vector<int> items;
};`;

describe('detectCodeLanguage', () => {
  it('detects C++ (vector, push_back, public:)', () => {
    expect(detectCodeLanguage(CPP)).toBe('cpp');
    expect(fileForLanguage('cpp')).toBe('input.cpp');
    expect(getLanguage('cpp').monaco).toBe('cpp');
  });

  it('detects python', () => {
    expect(detectCodeLanguage('def add(a, b):\n    return a + b\n')).toBe('python');
  });

  it('detects java', () => {
    expect(detectCodeLanguage('public class Main {\n  public static void main(String[] a) {\n    System.out.println("hi");\n  }\n}')).toBe('java');
  });

  it('detects typescript', () => {
    expect(detectCodeLanguage('interface User { id: string; }\nconst u: User = { id: "1" };')).toBe('typescript');
  });

  it('detects javascript', () => {
    expect(detectCodeLanguage('function greet(name) {\n  console.log("hi " + name);\n}')).toBe('javascript');
  });

  it('detects go', () => {
    expect(detectCodeLanguage('package main\n\nfunc main() {\n\tfmt.Println("hi")\n}')).toBe('go');
  });

  it('detects rust', () => {
    expect(detectCodeLanguage('fn main() {\n    let mut x = 1;\n    println!("{}", x);\n}')).toBe('rust');
  });

  it('detects sql', () => {
    expect(detectCodeLanguage('SELECT id, name FROM users WHERE id = 1;')).toBe('sql');
  });

  it('detects html', () => {
    expect(detectCodeLanguage('<!DOCTYPE html>\n<html><body><p>hi</p></body></html>')).toBe('html');
  });

  it('falls back to typescript for empty input', () => {
    expect(detectCodeLanguage('')).toBe('typescript');
    expect(detectCodeLanguage('   ')).toBe('typescript');
  });
});
