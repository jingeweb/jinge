/**
 * A javascript array differencing implementation.
 * Based on the algorithm proposed in ["An O(ND) Difference Algorithm and its Variations" (Myers, 1986)](http://citeseerx.ist.psu.edu/viewdoc/summary?doi=10.1.1.4.6927).
 *
 * Code bellow is copied from https://github.com/kpdecker/jsdiff/blob/master/src/diff/base.js
 * Modified by Yuhang Ge.
 *
 * NOTICE: This file is not used!
 */

function createSeg(type, count, value = null) {
  return {
    type, count, value
  };
}

function extractCommon(basePath, newArr, oldArr, diagonalPath) {
  const newLen = newArr.length;
  const oldLen = oldArr.length;
  let newPos = basePath.newPos;
  let oldPos = newPos - diagonalPath;
  let commonCount = 0;
  while (newPos + 1 < newLen && oldPos + 1 < oldLen && newArr[newPos + 1] === oldArr[oldPos + 1]) {
    newPos++;
    oldPos++;
    commonCount++;
  }

  if (commonCount) {
    basePath.components.push(createSeg(0, commonCount));
  }

  basePath.newPos = newPos;
  return oldPos;
}

function pushComponent(components, type) {
  const last = components[components.length - 1];
  if (last && last.type === type) {
    // We need to clone here as the component clone operation is just
    // as shallow array clone
    components[components.length - 1] = createSeg(type, last.count + 1);
  } else {
    components.push(createSeg(type, 1));
  }
}

function clonePath(path) {
  return createPath(path.newPos, path.components.slice());
}

function createPath(newPos, components) {
  return {
    newPos, components
  };
}

function buildValues(components, newArr, oldArr, useLongestToken) {
  const componentLen = components.length;
  let componentPos = 0;
  let newPos = 0;
  let oldPos = 0;

  for (; componentPos < componentLen; componentPos++) {
    const component = components[componentPos];
    if (component.type >= 0) {
      if (component.type <= 0 && useLongestToken) {
        let value = newArr.slice(newPos, newPos + component.count);
        value = value.map(function(value, i) {
          const oldValue = oldArr[oldPos + i];
          return oldValue.length > value.length ? oldValue : value;
        });

        component.value = value;
      } else {
        component.value = newArr.slice(newPos, newPos + component.count);
      }
      newPos += component.count;

      // Common case
      if (component.type <= 0) {
        oldPos += component.count;
      }
    } else {
      component.value = oldArr.slice(oldPos, oldPos + component.count);
      oldPos += component.count;

      // Reverse add and remove so removes are output first to match common convention
      // The diffing algorithm is tied to add then remove output and this is the simplest
      // route to get the desired output with minimal overhead.
      if (componentPos && components[componentPos - 1].type > 0) {
        const tmp = components[componentPos - 1];
        components[componentPos - 1] = components[componentPos];
        components[componentPos] = tmp;
      }
    }
  }

  return components;
}

export function diffArray(oldArr, newArr) {
  const newLen = newArr.length;
  const oldLen = oldArr.length;
  const maxEditLength = newLen + oldLen;
  const bestPath = [createPath(-1, [])];

  // Seed editLength = 0, i.e. the content starts with the same values
  const oldPos = extractCommon(bestPath[0], newArr, oldArr, 0);
  if (bestPath[0].newPos + 1 >= newLen && oldPos + 1 >= oldLen) {
    // Identity per the equality and tokenizer
    return [createSeg(0, newArr.length, newArr)]; // nothing changed.
  }

  let editLength = 1;
  // Main worker method. checks all permutations of a given edit length for acceptance.
  function execEditLength() {
    for (let diagonalPath = -1 * editLength; diagonalPath <= editLength; diagonalPath += 2) {
      let basePath;
      const addPath = bestPath[diagonalPath - 1];
      const removePath = bestPath[diagonalPath + 1];
      let oldPos = (removePath ? removePath.newPos : 0) - diagonalPath;
      if (addPath) {
        // No one else is going to attempt to use this value, clear it
        bestPath[diagonalPath - 1] = null;
      }

      const canAdd = addPath && addPath.newPos + 1 < newLen;
      const canRemove = removePath && oldPos >= 0 && oldPos < oldLen;
      if (!canAdd && !canRemove) {
        // If this path is a terminal then prune
        bestPath[diagonalPath] = null;
        continue;
      }

      // Select the diagonal that we want to branch from. We select the prior
      // path whose position in the new string is the farthest from the origin
      // and does not pass the bounds of the diff graph
      if (!canAdd || (canRemove && addPath.newPos < removePath.newPos)) {
        basePath = clonePath(removePath);
        pushComponent(basePath.components, -1);
      } else {
        basePath = addPath; // No need to clone, we've pulled it from the list
        basePath.newPos++;
        pushComponent(basePath.components, 1);
      }

      oldPos = extractCommon(basePath, newArr, oldArr, diagonalPath);

      // If we have hit the end of both strings, then we are done
      if (basePath.newPos + 1 >= newLen && oldPos + 1 >= oldLen) {
        return buildValues(basePath.components, newArr, oldArr);
      } else {
        // Otherwise track this path as a potential candidate and continue.
        bestPath[diagonalPath] = basePath;
      }
    }

    editLength++;
  }

  while (editLength <= maxEditLength) {
    const ret = execEditLength();
    if (ret) {
      return ret;
    }
  }

  // This should never happen, but we want to be safe.
  // Return null means nothing changed.
  return null;
}
