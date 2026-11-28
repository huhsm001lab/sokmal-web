// 소개 페이지 (/intro, 11-27): 처음 오는 사람에게 SOKMAL이 무엇인지 짧게 보여 주고 입장 화면(/)으로 보냄
import type { Metadata } from 'next';
import Link from 'next/link';
import './intro.css';

export const metadata: Metadata = {
  title: 'SOKMAL 속말 — 당신의 상상에는 정답이 없습니다',
  description: '입시 준비생부터 배우·작가·감독·연출가까지. AI가 대신 창작하는 곳이 아니라, 당신이 더 깊이 창작할 수 있는 곳.',
};

// 브랜드 철학 V1.0 (11-28 송무 확정) 「창작 경험의 흐름」 — 지금 있는 기능만 연결, 없는 건 준비 중으로
const flow: [string, string, string, boolean][] = [
  ['만들다', '독백 만들기', '묻고 쓰기, 갈래 보고 고르기, 줄마다 내 말로 고치기, 초안 다듬기, 번안하기.', false],
  ['이해하다', '해석', '줄거리·인물은 사실대로. 사실과 해석을 나눠 보고, 주제는 여러 갈래로 보여 줘요.', false],
  ['상상하다', '상상', '이미지·영상·음악으로 인물의 세계를 상상하게 도와요. 모범답안이 아니라 자극으로.', true],
  ['질문하다', '연기 대화', '정답보다 좋은 질문. 원리는 분명하게, 선택은 여러 갈래로.', false],
  ['탐구하다', '내 이미지 · 내 기록', '사진 없이 나를 말해 보고, 고르고 고친 과정을 남겨요.', false],
  ['표현하다', '당신의 몫', '연기·집필·연출은 당신이 해요. 우리는 연기 방식을 정해 주지 않아요.', false],
];
const who = [
  ['입시 준비생', '자신의 개성과 가능성을 발견하는 공간'],
  ['배우', '인물의 삶과 작품을 깊이 연구하고, 나만의 해석을 키우는 작업실'],
  ['작가', '인물과 이야기의 새로운 가능성을 실험하는 공간 (이야기 설계 준비 중)'],
  ['감독 · 연출가', '작품의 구조와 해석을 구체화하는 공간'],
];

export default function IntroPage() {
  return (
    <div className="in-page">
      <header className="in-top">
        <span className="in-mark" aria-hidden="true">속</span>
        <b>SOKMAL 속말</b>
        <Link href="/" className="in-top-go">
          로그인
        </Link>
      </header>

      <section className="in-hero">
        <p className="in-eye">입시 준비생부터 배우·작가·감독·연출가까지</p>
        <h1>
          당신의 상상에는
          <br />
          정답이 없습니다.
        </h1>
        <p className="in-lead">
          처음 독백을 준비하는 순간부터 하나의 작품이 완성되기까지. 쓰고, 읽고, 생각하고, 상상하고, 질문하고, 표현하는 모든 창작의 순간을
          함께합니다. AI가 당신을 대신해 창작하는 것이 아니라, 당신이 더 깊이 창작할 수 있도록.
        </p>
        <Link href="/" className="in-cta">
          가입하고 시작하기
        </Link>
        <p className="in-small">지금은 가입한 뒤 승인된 분이 쓰는 시험 기간이에요.</p>
      </section>

      <section className="in-sec">
        <h2>AI가 대신 창작하는 곳이 아닌, 사람이 더 잘 창작할 수 있는 곳</h2>
        <div className="in-grid3">
          <div className="in-card">
            <p className="in-k">대신 써 주는 AI</p>
            <p>빠르지만 내 이야기와 생각하는 시간이 함께 빠져요.</p>
          </div>
          <div className="in-card">
            <p className="in-k">하나의 정답</p>
            <p>정답처럼 받은 해석은 모두를 비슷한 연기로 이끌어요. 같은 작품에도 서로 다른 해석이 있어요.</p>
          </div>
          <div className="in-card">
            <p className="in-k">높은 문턱</p>
            <p>경험이나 교육 환경에 따라 시작부터 막막해요.</p>
          </div>
        </div>
        <p className="in-note">우리가 줄이고 싶은 것은 불필요한 어려움이지, 창작자가 생각하는 시간이 아닙니다.</p>
      </section>

      <section className="in-sec">
        <h2>창작의 여섯 순간</h2>
        <div className="in-grid2">
          {flow.map(([step, h, p, soon]) => (
            <div className={'in-card' + (soon ? ' in-soon' : '')} key={step}>
              <p className="in-k">
                {step} · {h} {soon ? <span className="in-badge">준비 중</span> : null}
              </p>
              <p>{p}</p>
            </div>
          ))}
        </div>
        <p className="in-note">정해진 순서가 아니라, 서로 이어지고 다시 시작되는 경험이에요. 입시 모드는 빠르고 분명하게, 전문 모드는 주고받으며 깊게.</p>
      </section>

      <section className="in-sec">
        <h2>누구를 위한 곳인가요</h2>
        <div className="in-grid2">
          {who.map(([h, p]) => (
            <div className="in-card" key={h}>
              <p className="in-k">{h}</p>
              <p>{p}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="in-sec in-soft">
        <h2>우리가 지키는 약속</h2>
        <ul className="in-list">
          <li>정답을 정하지 않아요. 해석은 여러 갈래로 보여 주고, 최종 선택은 언제나 창작자가 해요.</li>
          <li>감정을 강요하지 않아요. 호흡·강약·표정 같은 연기 방식을 지시하지 않고, 아픈 개인 경험을 연기의 조건으로 요구하지 않아요.</li>
          <li>대본에 없는 정보를 사실처럼 말하지 않아요. 사실과 추측과 해석을 나눠 보여 줘요.</li>
          <li>작품 원문을 싣지 않고 저작권을 존중해요. 결과는 AI와 함께 만든 것이라고 밝혀요.</li>
        </ul>
      </section>

      <footer className="in-foot">
        <p className="in-tag">
          창작의 진입장벽은 낮춘다. 창작의 깊이는 낮추지 않는다. 창작의 주체는 바꾸지 않는다.
        </p>
        <Link href="/" className="in-cta">
          가입하고 시작하기
        </Link>
        <p className="in-small">우리는 당신의 창작을 대신하지 않습니다. 당신의 창작과 함께합니다.</p>
      </footer>
    </div>
  );
}
