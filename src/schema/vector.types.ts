export type VectorColumnConfig = {
  dataType: () => string;
  toDriver: (value: number[]) => string;
  fromDriver: (value: string) => number[];
};
