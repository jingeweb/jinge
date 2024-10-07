import { type ViewModel, vm } from '../../src';
import { expectWatch } from './_helper';

describe('watch view-model', () => {
  it('deep watch array', async () => {
    const boy1 = vm({
      name: 'ge',
      children: [
        {
          name: 'yuang',
        },
      ],
    });
    await expectWatch(
      boy1 as unknown as ViewModel,
      (newV, oldV, propPath) => {
        console.info('boy1 deep notify.', newV === oldV, propPath);
        expect(newV).toBe(oldV);
        expect(propPath).toEqual(['children', 0, 'name']);
      },
      () => {
        boy1.children[0].name = 'cc';
      },
    );
  });
});
