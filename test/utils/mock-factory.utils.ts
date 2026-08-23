export class MockFactory {
  static create<T extends new (...args: any[]) => any>(clazz: T): jest.Mocked<InstanceType<T>> {
    const instance: any = {};
    const processedKeys = new Set<string>();

    let currentProto = clazz.prototype;
    while (currentProto && currentProto !== Object.prototype) {
      const descriptors = Object.getOwnPropertyDescriptors(currentProto);

      for (const [key, descriptor] of Object.entries(descriptors)) {
        if (key === 'constructor' || processedKeys.has(key)) continue;
        processedKeys.add(key);

        if (descriptor.get || descriptor.set) {
          Object.defineProperty(instance, key, {
            get: descriptor.get ? jest.fn(descriptor.get) : undefined,
            set: descriptor.set ? jest.fn(descriptor.set) : undefined,
            enumerable: descriptor.enumerable,
            configurable: true,
          });
        } else if (typeof descriptor.value === 'function') {
          instance[key] = jest.fn();
        }
      }
      currentProto = Object.getPrototypeOf(currentProto);
    }

    instance.constructor = clazz;
    instance.toString = jest.fn(() => clazz.name);
    return instance as jest.Mocked<InstanceType<T>>;
  }
}
