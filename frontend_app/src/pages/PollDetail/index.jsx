import Shell from "../../components/layout/Shell.jsx";
import TopBar from "../../components/topbar/TopBar.jsx";
import Icon from "../../components/ui/Icon.jsx";
import { pollOptions } from "../../consts/serviceData.js";

export default function PollDetailPage() {
  return (
    <Shell className="bg-background pb-28">
      <TopBar title="Голосування" backTo="/services/polls" rightIcon="share" dark />
      <main className="mx-auto w-full max-w-2xl px-container-padding pb-28 pt-section-margin sm:px-6 md:px-8">
        <div className="mb-4 flex flex-wrap justify-between gap-2">
          <span className="inline-flex items-center gap-1 rounded-full bg-primary-container px-3 py-1 text-xs font-bold text-on-primary">
            <Icon name="nature_people" className="text-base" /> Міський благоустрій
          </span>
          <span className="inline-flex items-center gap-1 rounded-full bg-error-container px-3 py-1 text-xs font-bold text-error">
            <Icon name="schedule" className="text-base" /> Залишилось 3 дні
          </span>
        </div>
        <h1 className="text-3xl font-bold leading-tight text-primary">Оновлення скверу на Польовій</h1>
        <p className="mt-4 text-base leading-7 text-on-surface-variant">Проєкт передбачає комплексний підхід до оновлення улюбленого місця відпочинку мешканців району. Планується встановлення сучасних енергозберігаючих ліхтарів, зручних паркових лав, а також створення безпечного та цікавого дитячого ігрового простору.</p>
        <div className="my-section-margin overflow-hidden rounded-xl border border-outline-variant/30 shadow-sm">
          <img className="aspect-video w-full object-cover" alt="" src="https://lh3.googleusercontent.com/aida-public/AB6AXuC3JVWM1HELJfdBhwFntwCbzZT_EqbMTrn4-eISQiKZlckjdfk3sJhq6iQD5FkQUF472Bxd1yspY3IXb1MnFdQFjGDz0IX2W6T-ljZg_chnNTjpAOAPsH6ZrsE3pZ1aqilWcKjaNvHJZolbhj0dB6AMwGMWTkM-DScdXR6ggWRcmBQxa5K0XMaaDMGooc_LjY-NZtS-i47uaWQtBJ0PV1iy63N3EK1z5FHcWXKOR-EY_JkjrbCoMiOR" />
        </div>
        <h2 className="mb-3 text-lg font-bold text-primary">Оберіть варіант реалізації:</h2>
        <form className="space-y-stack-gap">
          {pollOptions.map((option, index) => (
            <label key={option.title} className="flex cursor-pointer items-start rounded-xl border border-outline-variant/50 bg-surface-container-lowest p-4 transition has-[:checked]:border-secondary-container has-[:checked]:bg-secondary-container/10">
              <input className="mt-1 h-5 w-5 text-secondary-container focus:ring-secondary-container" defaultChecked={index === 0} name="voting_option" type="radio" />
              <span className="ml-3">
                <span className="block font-bold text-on-surface">{option.title}</span>
                <span className="mt-1 block text-sm leading-5 text-on-surface-variant">{option.text}</span>
              </span>
            </label>
          ))}
        </form>
      </main>
      <div className="fixed bottom-0 left-1/2 z-50 w-full max-w-[430px] -translate-x-1/2 border-t border-outline-variant/20 bg-surface/90 p-container-padding backdrop-blur-md md:max-w-[720px]">
        <button className="h-14 w-full rounded-full bg-secondary-container text-lg font-bold text-on-secondary-container shadow-sm active:scale-[0.98]">Проголосувати</button>
      </div>
    </Shell>
  );
}
