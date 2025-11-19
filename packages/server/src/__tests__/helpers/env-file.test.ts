import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, readFile, rm } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { writeEnvVar } from './env-file.js';

describe('writeEnvVar', () => {
  let tempDir: string;
  let envFilePath: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'env-test-'));
    envFilePath = join(tempDir, '.env');
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  it('should create new variable in empty file', async () => {
    await writeEnvVar(envFilePath, 'NEW_VAR', 'test_value');
    
    const content = await readFile(envFilePath, 'utf-8');
    expect(content).toBe('NEW_VAR=test_value\n');
  });

  it('should create new variable when file does not exist', async () => {
    await writeEnvVar(envFilePath, 'FIRST_VAR', 'first_value');
    
    const content = await readFile(envFilePath, 'utf-8');
    expect(content).toBe('FIRST_VAR=first_value\n');
  });

  it('should append new variable to existing content', async () => {
    await writeEnvVar(envFilePath, 'VAR1', 'value1');
    await writeEnvVar(envFilePath, 'VAR2', 'value2');
    
    const content = await readFile(envFilePath, 'utf-8');
    expect(content).toBe('VAR1=value1\nVAR2=value2\n');
  });

  it('should update existing variable', async () => {
    await writeEnvVar(envFilePath, 'EXISTING_VAR', 'old_value');
    await writeEnvVar(envFilePath, 'EXISTING_VAR', 'new_value');
    
    const content = await readFile(envFilePath, 'utf-8');
    expect(content).toBe('EXISTING_VAR=new_value\n');
  });

  it('should preserve other lines when updating', async () => {
    await writeEnvVar(envFilePath, 'VAR1', 'value1');
    await writeEnvVar(envFilePath, 'VAR2', 'value2');
    await writeEnvVar(envFilePath, 'VAR3', 'value3');
    await writeEnvVar(envFilePath, 'VAR2', 'updated_value2');
    
    const content = await readFile(envFilePath, 'utf-8');
    expect(content).toBe('VAR1=value1\nVAR2=updated_value2\nVAR3=value3\n');
  });

  it('should not add extra trailing whitespace', async () => {
    await writeEnvVar(envFilePath, 'VAR1', 'value1');
    await writeEnvVar(envFilePath, 'VAR2', 'value2');
    
    const content = await readFile(envFilePath, 'utf-8');
    expect(content).toBe('VAR1=value1\nVAR2=value2\n');
    expect(content.endsWith('\n\n')).toBe(false);
  });

  it('should be idempotent when value unchanged', async () => {
    await writeEnvVar(envFilePath, 'STABLE_VAR', 'stable_value');
    const firstContent = await readFile(envFilePath, 'utf-8');
    
    await writeEnvVar(envFilePath, 'STABLE_VAR', 'stable_value');
    const secondContent = await readFile(envFilePath, 'utf-8');
    
    expect(firstContent).toBe(secondContent);
    expect(firstContent).toBe('STABLE_VAR=stable_value\n');
  });

  it('should handle values with special characters', async () => {
    await writeEnvVar(envFilePath, 'COMPLEX_VAR', 'value-with_special.chars123');
    
    const content = await readFile(envFilePath, 'utf-8');
    expect(content).toBe('COMPLEX_VAR=value-with_special.chars123\n');
  });

  it('should handle keys with underscores and numbers', async () => {
    await writeEnvVar(envFilePath, 'VAR_NAME_123', 'test_value');
    
    const content = await readFile(envFilePath, 'utf-8');
    expect(content).toBe('VAR_NAME_123=test_value\n');
  });

  it('should preserve empty lines within content', async () => {
    await writeEnvVar(envFilePath, 'VAR1', 'value1');
    // Manually add empty line
    let content = await readFile(envFilePath, 'utf-8');
    content = content.trimEnd() + '\n\nVAR2=value2\n';
    await require('fs/promises').writeFile(envFilePath, content, 'utf-8');
    
    await writeEnvVar(envFilePath, 'VAR3', 'value3');
    
    const finalContent = await readFile(envFilePath, 'utf-8');
    expect(finalContent).toBe('VAR1=value1\n\nVAR2=value2\nVAR3=value3\n');
  });

  it('should update only the matching variable', async () => {
    await writeEnvVar(envFilePath, 'PREFIX_VAR', 'value1');
    await writeEnvVar(envFilePath, 'PREFIX_VAR_LONG', 'value2');
    await writeEnvVar(envFilePath, 'PREFIX_VAR', 'updated1');
    
    const content = await readFile(envFilePath, 'utf-8');
    expect(content).toBe('PREFIX_VAR=updated1\nPREFIX_VAR_LONG=value2\n');
  });
});
