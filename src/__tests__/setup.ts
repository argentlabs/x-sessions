// Test setup file to provide necessary polyfills for starknet library
import { vi } from "vitest"

// Mock WebSocket for Node.js environment
global.WebSocket = vi.fn().mockImplementation(() => ({
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
  send: vi.fn(),
  close: vi.fn(),
  readyState: 1, // OPEN
  CONNECTING: 0,
  OPEN: 1,
  CLOSING: 2,
  CLOSED: 3,
})) as any

// Mock fetch if not available
if (!global.fetch) {
  global.fetch = vi.fn()
}

// Mock crypto if not available
if (!global.crypto) {
  global.crypto = {
    getRandomValues: vi.fn((arr) => {
      for (let i = 0; i < arr.length; i++) {
        arr[i] = Math.floor(Math.random() * 256)
      }
      return arr
    }),
    subtle: {
      generateKey: vi.fn(),
      importKey: vi.fn(),
      exportKey: vi.fn(),
      sign: vi.fn(),
      verify: vi.fn(),
      digest: vi.fn(),
    },
  } as any
}

// Mock TextEncoder/TextDecoder if not available
if (!global.TextEncoder) {
  global.TextEncoder = class TextEncoder {
    encode(input?: string): Uint8Array {
      return new Uint8Array(Buffer.from(input || "", "utf8"))
    }
  } as any
}

if (!global.TextDecoder) {
  global.TextDecoder = class TextDecoder {
    decode(input?: Uint8Array): string {
      return Buffer.from(input || new Uint8Array()).toString("utf8")
    }
  } as any
}

// Mock performance if not available
if (!global.performance) {
  global.performance = {
    now: vi.fn(() => Date.now()),
  } as any
}

// Mock localStorage if not available
if (!global.localStorage) {
  global.localStorage = {
    getItem: vi.fn(),
    setItem: vi.fn(),
    removeItem: vi.fn(),
    clear: vi.fn(),
    key: vi.fn(),
    length: 0,
  } as any
}

// Mock sessionStorage if not available
if (!global.sessionStorage) {
  global.sessionStorage = {
    getItem: vi.fn(),
    setItem: vi.fn(),
    removeItem: vi.fn(),
    clear: vi.fn(),
    key: vi.fn(),
    length: 0,
  } as any
}
