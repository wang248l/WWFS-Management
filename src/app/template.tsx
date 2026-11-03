/** 每次换页淡入上浮一下（进工位、回办公室都有过渡）。 */
export default function Template({ children }: { children: React.ReactNode }) {
  return <div className="page-enter">{children}</div>;
}
