import { buttonStyles } from "@/components/ui";
import { catalogTabs, type CatalogTab } from "./catalog-utils";

type Props = {
  tab: CatalogTab;
  onTabChange: (tab: CatalogTab) => void;
};

export default function CatalogTabs({ tab, onTabChange }: Props) {
  return (
    <div className="mb-4 flex flex-wrap gap-2">
      {catalogTabs.map((item) => {
        const Icon = item.icon;
        const active = tab === item.id;
        return (
          <button
            key={item.id}
            type="button"
            onClick={() => onTabChange(item.id)}
            className={buttonStyles({ variant: active ? "primary" : "secondary", size: "sm" })}
          >
            <Icon size={15} />
            {item.label}
          </button>
        );
      })}
    </div>
  );
}
