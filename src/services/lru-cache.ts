export class LRUCache<K, V> {
	private map = new Map<K, V>();
	constructor(private limit: number) {}

	get(key: K): V | undefined {
		const value = this.map.get(key);
		if (value !== undefined) {
			this.map.delete(key);
			this.map.set(key, value);
		}
		return value;
	}

	set(key: K, value: V): void {
		if (this.map.has(key)) {
			this.map.delete(key);
		} else if (this.map.size >= this.limit) {
			const oldestKey = this.map.keys().next().value as K | undefined;
			if (oldestKey !== undefined) {
				this.map.delete(oldestKey);
			}
		}
		this.map.set(key, value);
	}

	size(): number {
		return this.map.size;
	}
}

import { createHash } from "crypto";

export function hashString(text: string): string {
	return createHash("sha1").update(text).digest("hex");
}
