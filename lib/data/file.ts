// 내 컴퓨터에서 시험할 때 쓰는 파일 저장소. 서버를 껐다 켜도 횟수·AI 비용·의견이 남는다.
import { FileKv } from './kv';
import { KvStore } from './kvstore';

export class FileStore extends KvStore {
  constructor(file: string) {
    super(new FileKv(file));
  }
}
