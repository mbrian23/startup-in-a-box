import Slide from '@/components/Slide';
import QrCode from '@/components/QrCode';
import type { SlideProps } from './types';

export const meta = {
  id: '02-whoami',
  number: 2,
  chapter: 'Intro',
  title: '/whoami',
  tint: 'cream' as const,
  notes: `Línea cruda: "Soy Martin Brian, Senior AI Engineer. Estoy acá porque me gusta romper cosas antes que el usuario final."
Punchline no escrito: "En este caso la cosa rota es una empresa entera."
Pregunta probable: "¿Dónde está el repo?" → "github.com/mbrian23/startup-in-a-box — abierto, MIT."`,
};

export default function WhoAmI({}: SlideProps) {
  return (
    <Slide tint="cream" chapter="Intro" title="/whoami">
      <div className="grid grid-cols-[1.6fr_1fr] gap-12 items-start h-full">
        <div className="space-y-6">
          <div>
            <div className="font-pixel text-[12px] tracking-wider text-cream/75">NOMBRE</div>
            <div className="font-display text-[34px] text-cream mt-3 glow-text">Martin Brian</div>
          </div>
          <div>
            <div className="font-pixel text-[12px] tracking-wider text-cream/75">ROL</div>
            <div className="text-gold text-[26px] mt-3 glow-text">Senior AI Engineer</div>
          </div>
          <div className="pt-3 grid grid-cols-2 gap-4 text-[18px]">
            <div>
              <div className="font-pixel text-[11px] text-cream/70">LINKEDIN</div>
              <div className="text-cyan mt-1">linkedin.com/in/martinbrianmdbn</div>
            </div>
            <div>
              <div className="font-pixel text-[11px] text-cream/70">REPO</div>
              <div className="text-cyan mt-1">github.com/mbrian23/startup-in-a-box</div>
            </div>
          </div>
          <div className="pt-6 text-cream/95 max-w-[62ch] text-[22px] leading-relaxed italic">
            “Un proyecto de fin de semana que se fue de las manos.”
          </div>
        </div>
        <div className="flex flex-col items-center justify-center gap-4">
          <QrCode url="https://www.linkedin.com/in/martinbrianmdbn/" size={260} label="escaneá → linkedin" />
          <div className="text-cream/70 font-pixel text-[12px] text-center max-w-[26ch] leading-relaxed">
            cuando el repo abra, el link aterriza acá
          </div>
        </div>
      </div>
    </Slide>
  );
}
