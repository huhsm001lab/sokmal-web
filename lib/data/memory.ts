// 키 없이 개발·테스트할 때, 또는 DB 없이 운영할 때 쓰는 메모리 저장소. 서버를 다시 켜면 비워진다.
import { MemKv } from './kv';
import { KvStore } from './kvstore';

export class MemoryStore extends KvStore {
  constructor() {
    super(new MemKv());
  }
}
