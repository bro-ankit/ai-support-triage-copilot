export type VectorIndexOptions = {
  indexName: string;
  prefix: string;
  vectorField: string;
  dimensions: number;
  distanceMetric: 'COSINE' | 'L2' | 'IP';
};

export type NearestVectorMatch<T> = {
  distance: number;
  value: T;
};
