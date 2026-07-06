export interface CatalogFormField {
  key: string;
  label: string;
  type: "text" | "email" | "textarea" | "select" | "date";
  required: boolean;
  placeholder: string;
  options: string[];
  max_length: number;
  help?: string;
}

export interface CatalogIconOption {
  key: string;
  label: string;
}

export interface CatalogOptions {
  categories: string[];
  icons: CatalogIconOption[];
  fields: CatalogFormField[];
}

export interface CatalogService {
  id: number;
  name: string;
  category: string;
  description: string;
  icon: string;
  color: string;
  active: boolean;
  form_schema: { fields?: CatalogFormField[] };
}

