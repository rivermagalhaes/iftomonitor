import { test, expect } from 'vitest';
import { acceptConsent, authorize } from '../src/services/modes';
import { databaseName } from '../src/data/repository';
import { memoryRepository } from './support';
test('demo usa banco distinto e autorização exige termo e apelido', async () => { expect(databaseName('demo')).not.toBe(databaseName('field')); const repo = memoryRepository('ifto_monitor'); await expect(authorize(repo, 'field', null)).rejects.toThrow(); await expect(acceptConsent(repo, '', true)).rejects.toThrow(); await acceptConsent(repo, 'AB', true); await expect(authorize(repo, 'field', null)).resolves.toBeUndefined(); await expect(authorize(repo, 'demo', null)).rejects.toThrow(); });
