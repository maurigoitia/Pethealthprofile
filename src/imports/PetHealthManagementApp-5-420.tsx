import imgImage from "figma:asset/e4b9cb13fdb59713820f2da9cb50d2aa5431cc45.png";

function Image() {
  return (
    <div className="h-[1272.997px] relative shrink-0 w-[670.388px]" data-name="Image">
      <img alt="" className="absolute bg-clip-padding border-0 border-[transparent] border-solid inset-0 max-w-none object-contain pointer-events-none size-full" src={imgImage} />
    </div>
  );
}

function Container1() {
  return (
    <div className="h-[1228.796px] opacity-25 relative w-[565.198px]" data-name="Container">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid content-stretch flex items-center justify-center relative size-full">
        <Image />
      </div>
    </div>
  );
}

function Container() {
  return (
    <div className="absolute content-stretch flex h-[853.046px] items-center justify-center left-0 pl-[0.011px] top-0 w-[392.695px]" data-name="Container">
      <div className="flex h-[1273.381px] items-center justify-center relative shrink-0 w-[670.145px]" style={{ "--transform-inner-width": "1200", "--transform-inner-height": "19" } as React.CSSProperties}>
        <div className="flex-none rotate-5">
          <Container1 />
        </div>
      </div>
    </div>
  );
}

function Container2() {
  return <div className="absolute bg-[rgba(255,255,255,0.1)] blur-[64px] left-[120.69px] rounded-[24675400px] size-[399.992px] top-[-127.99px]" data-name="Container" />;
}

function Container3() {
  return <div className="absolute bg-[rgba(255,255,255,0.05)] blur-[64px] left-[-80px] rounded-[24675400px] size-[299.991px] top-[473.06px]" data-name="Container" />;
}

function Heading() {
  return (
    <div className="h-[71.999px] relative shrink-0 w-[182.18px]" data-name="Heading 1">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid relative size-full">
        <p className="absolute font-['DM_Sans:Black',sans-serif] font-black leading-[72px] left-0 text-[72px] text-white top-[-0.03px] tracking-[-3.6px]" style={{ fontVariationSettings: "'opsz' 14" }}>
          Pessy
        </p>
      </div>
    </div>
  );
}

function Paragraph() {
  return (
    <div className="h-[23.992px] relative shrink-0 w-[287.995px]" data-name="Paragraph">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid relative size-full">
        <p className="-translate-x-1/2 absolute font-['DM_Sans:Medium',sans-serif] font-medium leading-[24px] left-[144px] text-[16px] text-[rgba(255,255,255,0.8)] text-center top-[-0.26px] tracking-[0.4px]" style={{ fontVariationSettings: "'opsz' 14" }}>
          tu mascota sus cosas todo en orden
        </p>
      </div>
    </div>
  );
}

function Container5() {
  return (
    <div className="h-[119.983px] relative shrink-0 w-[287.995px]" data-name="Container">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid content-stretch flex flex-col gap-[23.992px] items-center relative size-full">
        <Heading />
        <Paragraph />
      </div>
    </div>
  );
}

function Button() {
  return (
    <div className="bg-white h-[71.976px] relative rounded-[40px] shadow-[0px_25px_50px_0px_rgba(0,0,0,0.25)] shrink-0 w-full" data-name="Button">
      <p className="-translate-x-1/2 absolute font-['DM_Sans:Bold',sans-serif] font-bold leading-[24px] left-[164.57px] text-[#2b7cee] text-[16px] text-center top-[23.73px] tracking-[1.6px] uppercase" style={{ fontVariationSettings: "'opsz' 14" }}>
        Ingresar
      </p>
    </div>
  );
}

function Button1() {
  return (
    <div className="bg-[rgba(255,255,255,0.2)] h-[74.917px] relative rounded-[40px] shrink-0 w-full" data-name="Button">
      <div aria-hidden="true" className="absolute border-[1.471px] border-[rgba(255,255,255,0.3)] border-solid inset-0 pointer-events-none rounded-[40px]" />
      <p className="-translate-x-1/2 absolute font-['DM_Sans:Bold',sans-serif] font-bold leading-[24px] left-[164.58px] text-[16px] text-center text-white top-[25.2px] tracking-[1.6px] uppercase" style={{ fontVariationSettings: "'opsz' 14" }}>
        Crear cuenta
      </p>
    </div>
  );
}

function Container6() {
  return (
    <div className="h-[390.88px] relative shrink-0 w-[328.717px]" data-name="Container">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid content-stretch flex flex-col gap-[19.993px] items-start pt-[223.994px] relative size-full">
        <Button />
        <Button1 />
      </div>
    </div>
  );
}

function Container4() {
  return (
    <div className="absolute content-stretch flex flex-col gap-[47.995px] h-[558.858px] items-center left-[31.99px] top-[147.09px] w-[328.717px]" data-name="Container">
      <Container5 />
      <Container6 />
    </div>
  );
}

export default function PetHealthManagementApp() {
  return (
    <div className="relative size-full" data-name="Pet Health Management App" style={{ backgroundImage: "linear-gradient(rgb(43, 124, 238) 0%, rgb(61, 139, 255) 50%, rgb(93, 163, 255) 100%), linear-gradient(90deg, rgb(255, 255, 255) 0%, rgb(255, 255, 255) 100%)" }}>
      <Container />
      <Container2 />
      <Container3 />
      <Container4 />
    </div>
  );
}