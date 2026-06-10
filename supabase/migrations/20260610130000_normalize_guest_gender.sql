-- 게스트 추가 폼이 예전엔 성별을 자유 텍스트로 받아 운영자가 "남성"/"여성"
-- 같은 한국어로 입력하던 흔적이 있다. club_record_guest_profiles.gender 는
-- 자동 편성 알고리즘이 'male' | 'female' | 'unspecified' enum 으로 비교하기
-- 때문에 한국어 값은 절대 매치되지 않아 여복 룰이 영원히 미발동 상태였다.
--
-- 1. 기존 데이터에서 알아볼 수 있는 한국어 값을 enum 으로 정규화한다.
-- 2. 새 데이터가 또 비enum 으로 들어오지 못하도록 CHECK 를 건다.

update public.club_record_guest_profiles
set gender = case
  when gender in ('male', 'female', 'unspecified') then gender
  when btrim(gender) in ('남', '남성', '남자', 'M', 'm') then 'male'
  when btrim(gender) in ('여', '여성', '여자', 'F', 'f') then 'female'
  else null
end
where gender is not null;

alter table public.club_record_guest_profiles
  drop constraint if exists club_record_guest_profiles_gender_check;

alter table public.club_record_guest_profiles
  add constraint club_record_guest_profiles_gender_check
  check (
    gender is null
    or gender in ('male', 'female', 'unspecified')
  );
