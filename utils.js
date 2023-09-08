const throttle = (time) => {
  let lastTime = 0;
  return (fn) => {
    return (...args) => {
      const currentTime = new Date().getTime();
      if ((currentTime - lastTime) > time) {
        fn(...args);
        lastTime = currentTime;
      };
    };
  };
};

const countCommonCharacters = (str1, str2) => {
  const set1 = new Set(str1);
  const set2 = new Set(str2);

  let commonCount = 0;
  set1.forEach(char => {
    if (set2.has(char)) {
      commonCount++;
    }
  });

  return commonCount;
};