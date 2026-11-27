// 소개 페이지 (/intro, 11-27): 처음 오는 사람에게 SOKMAL이 무엇인지 짧게 보여 주고 입장 화면(/)으로 보냄
import type { Metadata } from 'next';
import Link from 'next/link';
import './intro.css';

export const metadata: Metadata = {
  title: 'SOKMAL 속말 — 배우와 창작자를 위한 AI 작업실',
  description: '쓰기 전에 먼저 묻는 독백 작업실. 배우가 답한 자기 이야기로 독백을 쓰고, 작품은 여러 갈래로 넓게 읽게 돕습니다.',
};

const steps = [
  ['01', '먼저 묻는다', '누구에게 하는 말인지, 그때 실제로 있었던 일, 오늘 꼭 하고 싶은 한마디.'],
  ['02', '배우가 답한다', '거창하지 않아도 돼요. 놓친 고맙다는 말 하나면 충분해요.'],
  ['03', '그 답으로 쓴다', '말투가 아니라 재료가 다른, 그 사람만의 독백.'],
];
const features = [
  ['작품 해석', '줄거리·인물은 사실대로, 주제는 여러 갈래로 보여 줘요. 독백으로 쓸 만한 구간도 함께.'],
  ['독백 만들기', '묻고 쓰기, 내 초안 다듬기, 책·웹툰·영화의 문장을 내 상황으로 번안하기.'],
  ['내 이미지', '사진 없이 자기 서술과 열 가지 질문으로. 정해 주지 않는 참고 자료예요.'],
  ['내 기록', '고르고 고친 독백·해석·분석 메모가 남아요.'],
];

export default function IntroPage() {
  return (
    <div className="in-page">
      <header className="in-top">
        <span className="in-mark" aria-hidden="true">속</span>
        <b>SOKMAL 속말</b>
        <Link href="/" className="in-top-go">
          초대 코드로 입장
        </Link>
      </header>

      <section className="in-hero">
        <p className="in-eye">배우와 창작자를 위한 AI 작업실</p>
        <h1>
          AI가 써 준 독백,
          <br />
          그건 누구의 이야기인가요?
        </h1>
        <p className="in-lead">
          SOKMAL은 쓰기 전에 먼저 묻습니다. 배우가 답한 자기 이야기로 독백을 쓰고, 작품은 여러 갈래로 넓게 읽게 돕습니다. 연기와 선택은 배우가
          정합니다.
        </p>
        <Link href="/" className="in-cta">
          초대 코드로 시작하기
        </Link>
        <p className="in-small">지금은 초대받은 분만 참여할 수 있는 시험 기간이에요.</p>
      </section>

      <section className="in-sec">
        <h2>모두가 AI로 독백을 쓰지만, 그 안에 배우의 이야기가 없습니다</h2>
        <div className="in-grid3">
          <div className="in-card">
            <p className="in-k">창작 독백</p>
            <p>입시와 오디션에서 창작 독백은 이제 사실상 필수예요. 혼자 쓰기는 막막해요.</p>
          </div>
          <div className="in-card">
            <p className="in-k">일반 AI</p>
            <p>글은 매끄럽지만 말투만 그럴싸한 남의 이야기가 나와요. 흔한 소품과 장면이 반복돼요.</p>
          </div>
          <div className="in-card">
            <p className="in-k">지정희곡</p>
            <p>짧은 시간에 작품을 읽어야 하는데, 일반 AI는 국내 희곡 줄거리를 자주 틀려요.</p>
          </div>
        </div>
      </section>

      <section className="in-sec">
        <h2>쓰기 전에, 먼저 묻습니다</h2>
        <ol className="in-steps">
          {steps.map(([n, h, p]) => (
            <li key={n}>
              <span className="in-n">{n}</span>
              <b>{h}</b>
              <p>{p}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="in-sec">
        <h2>할 수 있는 것</h2>
        <div className="in-grid2">
          {features.map(([h, p]) => (
            <div className="in-card" key={h}>
              <p className="in-k">{h}</p>
              <p>{p}</p>
            </div>
          ))}
        </div>
        <p className="in-note">입시 모드는 빠르고 분명하게, 전문 모드는 주고받으며 깊게.</p>
        <div className="in-card in-soon">
          <p className="in-k">
            이야기 설계 <span className="in-badge">작가용 · 준비 중</span>
          </p>
          <p>주제·인물·갈등·사건을 적으면 비어 있거나 약한 곳을 짚어 줘요. 빈칸을 대신 채우지는 않아요. 전문 모드에서 칸을 미리 볼 수 있어요.</p>
        </div>
      </section>

      <section className="in-sec in-soft">
        <h2>지키는 것</h2>
        <ul className="in-list">
          <li>호흡·강약·감정·표정 같은 연기 방식은 지시하지 않아요. 그건 배우의 몫이니까요.</li>
          <li>판단은 정해 주지 않고, 근거와 함께 보여 줘요.</li>
          <li>결과는 AI와 함께 쓴 글이라고 밝혀요.</li>
        </ul>
      </section>

      <footer className="in-foot">
        <p className="in-tag">더 넓게 읽고, 내 이야기는 놓치지 않게.</p>
        <Link href="/" className="in-cta">
          초대 코드로 시작하기
        </Link>
        <p className="in-small">초대 코드는 SOKMAL 팀에게 받을 수 있어요.</p>
      </footer>
    </div>
  );
}
