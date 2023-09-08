/**
 * @typedef {Object} SkillData
 * @property {number} id - id
 * @property {string} name - 技能名
 * @property {string} iconUrl - 图标
 * @property {number[]} value - 值
 * @property {number} duration - 持续时间
 * @property {number} needPt - 所需pt
 * @property {string} type - 效果类型
 * @property {string} desc - 描述
 * @property {string} condition - 触发条件
 */

/**
 * @typedef {Object} EventData
 * @property {number} nameLength - 名字长度
 * @property {string} name - 名字
 * @property {number[] | null} skillIds - 技能ids
 * @property {SelectList[]} selectList - 选项
 */

/**
 * @typedef {Object} SelectList
 * @property {string} option - 选项
 * @property {string[]} gain_list - 获得列表
 */

/**
 * @typedef {Object} Data
 * @property {EventData[]} main - 主线
 * @property {EventData[]} eventList - 支援卡
 * @property {EventData[]} characterEventList - 角色
 * @property {Record<string | number,SkillData>} skills - 技能
 */

/** @param {Render} render */
const createCharacterList = (data, render) => {
  const DOM = document.getElementById("current-character");
  const toggle = (name, eventData) => {
    DOM.innerHTML = `已选择 <span style="color: red;">${name}</span> `;
    render.toggleCharacter(eventData);
  };

  let DOMs = [];
  for (const { info: { name, icon }, event } of data) {
    const li = document.createElement("li");
    const img = document.createElement("img");
    const p = document.createElement("p");
    const label = document.createElement("label");

    img.src = icon;
    img.onclick = () => toggle(name, event);
    p.innerText = name;
    label.setAttribute("for", "select-character");
    label.append(img);
    li.append(label, p);

    DOMs.push(li);
  }
  for (let i = 0; i < 4; i++) {
    const li = document.createElement("li");
    DOMs.push(li);
  }

  return DOMs;
};

const getWorker = async () => {
  const { createWorker } = Tesseract;
  const worker = await createWorker({
    langPath: "https://tessdata.projectnaptha.com/4.0.0_best"
  });
  await worker.loadLanguage("chi_sim+eng");
  await worker.initialize("chi_sim+eng");
  return worker;
};

const getScreen = async () => {
  const options = { video: true };
  const mediaDevices = navigator.mediaDevices;
  const screen = mediaDevices.getDisplayMedia ? await mediaDevices.getDisplayMedia(options) : await mediaDevices.getUserMedia(options);
  return screen;
};
/**
 * 
 * @param {HTMLVideoElement} videoElement 
 * @returns {Promise<Blob>}
 */
const getImgFn = (videoElement) => {
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");

  return async () => {
    const { videoWidth, videoHeight } = videoElement;
    const height = 135;
    canvas.width = videoWidth;
    canvas.height = height;
    context.clearRect(0, 0, videoWidth, height);
    context.drawImage(videoElement, (videoWidth - 35) / 10 * 1.52, (videoHeight - 35) / 10 * 1.82, videoWidth, videoHeight, 30, 0, videoWidth * 1.52, videoHeight * 1.52);

    const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;
    for (let i = 0; i < data.length; i += 4) {
      const grayscale = (data[i] + data[i + 1] + data[i + 2]) / 3;
      const binaryValue = (255 - grayscale) * 6.5;
      data[i] = binaryValue;
      data[i + 1] = binaryValue;
      data[i + 2] = binaryValue;
    }
    context.putImageData(imageData, 0, 0);
    return await new Promise(res => canvas.toBlob((b) => res(b)));;
  };
};

class Switch {
  /** @type {number | null} */
  timer = null;
  /** @type {Render} */
  render = null;
  throttle = throttle(600);
  constructor(render) { this.render = render; }

  open = this.throttle((e) => {
    if (!this.render.getImg) {
      alert("尚未选择窗口");
      return;
    };
    if (!this.render.data.characterEventList) {
      alert("尚未选择优俊少女");
      return;
    };

    e.target.innerText = "关闭监听";
    this.timer = 1;
    this.render.render().then(() => this.monitorOpen());
    this.to = this.close;
  });
  close = this.throttle((e) => {
    e.target.innerText = "开始监听";
    this.monitorClose();
    this.to = this.open;
  });
  to = this.open;

  monitorOpen () {
    if (this.timer === null) return;
    this.timer = setTimeout(() => {
      this.render.render().then(() => this.monitorOpen());
    }, 550);
  }
  monitorClose () {
    clearTimeout(this.timer);
    this.timer = null;
  }
};

class Render {
  /** @type { HTMLVideoElement} */
  videoElement = null;

  getImg = null;
  /** @type { HTMLPreElement} */
  eventNameDOM = null;
  /** @type { HTMLUListElement} */
  listDOM = null;
  /** @type { HTMLUListElement} */
  skillDOM = null;

  isDOM = false;
  text = "";
  /** @type { EventData} */
  currentEvent = {};

  eventId = [
    {
      id: "主线",
      key: "main"
    },
    {
      id: "协助卡",
      key: "eventList"
    },
    {
      id: "养成优俊少女",
      key: "characterEventList"
    }
  ];
  /** @type {Data} */
  data = {};

  initDOM () {
    this.listDOM = document.querySelector("#event");
    this.skillDOM = document.querySelector(".skill-list");
  }

  toggleCharacter (characterEvent) {
    this.data.characterEventList = characterEvent;
  }

  async render () {
    const textString = await this.recognizeText();
    const [text, eventKey] = this.processText(textString);
    if (!text) return;

    const event = this.getEvent(text, eventKey);
    const { listDOM, skillDOM, currentEvent } = this;
    console.log(`
value: ${text},
k e y: ${eventKey}
    `);
    if (!event || event.name === currentEvent?.name) return;
    const eventDOMString = this.createEventElement(event);
    listDOM.innerHTML = eventDOMString;
    if (event.skillIds) {
      const skills = event.skillIds.map((p) => this.data.skills[p]);
      const skillDOMString = this.createSkillElement(skills);
      skillDOM.innerHTML = skillDOMString;
    }
    this.isDOM = true;

    this.currentEvent = event;
  }
  /** 
   * @param {string} text 
   * @param {"main" | "eventList" | "characterEventList"} key 
   * @returns {EventData}
   */
  getEvent (text, key) {
    const { data } = this;
    const [min, max] = [text.length - 1, text.length + 2];

    const eventList = data[key].filter((p) => {
      const nameLen = p.nameLength;
      return nameLen >= min && nameLen <= max;
    });

    const result = eventList.find((item) => {
      if (text === item.name) return item;
      const count = countCommonCharacters(text, item.name);
      if (count === text.length || count >= 3) return item;
    });

    return result;
  }
  /** @returns {Promise<string>} */
  async recognizeText () {
    const image = URL.createObjectURL(await this.getImg());
    const { data: { text } } = await tesseractWorker.recognize(image);
    URL.revokeObjectURL(image);
    return text.replaceAll(" ", "");
  }
  /** 
   * @param {string} textString 
   * @returns {string[]} 
  */
  processText (textString) {
    const [eventId, text] = textString.split("\n");
    const eventIndex = this.eventId.find(p => countCommonCharacters(p.id, eventId) > 0);

    if (!text || !eventIndex || !text.replace(/[^\u4e00-\u9fa5a-zA-Z\n]/g, "")) {
      this.clear();
      return [];
    }
    if (this.text === text || (countCommonCharacters(this.text, text) > 2)) {
      return [];
    };

    this.text = text;
    return [text, eventIndex.key];
  }

  clear () {
    if (this.isDOM) {
      this.skillDOM.innerHTML = ``;
      this.listDOM.innerHTML = `
      <p class="event-name">null</p>
      <ul class="event-list">
        <li class="null"></li>
      </ul>`;
    }
    this.isDOM = false;
  }
  /** @param {EventData} event  */
  createEventElement (event) {
    let DOMString = `
    <p class="event-name">${event.name}</p>
    <ul class="event-list">`;
    for (const item of event.selectList) {
      DOMString += `
      <li>
        <p><span>${item.option}</span></p>
        <p>${item.gain_list.join("or\n")}</p>
      </li>`;
    }
    DOMString += `</ul>`;
    return DOMString;
  }
  /** @param {SkillData[]} skills  */
  createSkillElement (skills) {
    let DOMString = "";
    for (const item of skills) {
      DOMString += `
        <li>
        <div>
          <img src="${item.iconUrl}">
          <span>${item.name}</span>
        </div>
        <p>
          <span>技能点数</span>
          <span>${item.needPt}pt</span>
        </p>
        <p>
          <span>技能类型</span>
          <span>${item.type}</span>
        </p>
        <p>
          <span>技能数值</span>
          <span>${item.value.map(p => p / 10000).join("﹑")}</span>
        </p>
        <p>
          <span>持续时间</span>
          <span>${item.duration ? item.duration / 10000 : "瞬间"}</span>
        </p>
        <p>
          <span>触发条件</span>
          <span>${item.condition}</span>
        </p>
        <p>
          <span>技能描述</span>
          <span>${item.desc}</span>
        </p>
      </li>`;
    }
    return DOMString;
  };
}

let umamusumeData;
let tesseractWorker;
const render = new Render();
const toSwitch = new Switch(render);

const initData = async () => {
  const data = await fetch("https://gist.githubusercontent.com/bambooGHT/ec54f689fff02b76d19a7b7688bc0a8a/raw/umamusume.json");
  const worker = await getWorker();
  const characterListDOM = document.querySelector(".character-list");
  const dom = document.getElementById("get");

  tesseractWorker = worker;
  umamusumeData = JSON.parse(await data.text());
  characterListDOM.innerHTML = "";
  characterListDOM.append(...createCharacterList(umamusumeData.characterList, render));
  dom.innerText = "点击选择窗口";
};

initData();

const init = async () => {
  if (!tesseractWorker || render.getImg) return;
  const screen = await getScreen();
  const videoElement = document.createElement("video");
  videoElement.srcObject = screen;
  videoElement.play();

  const data = {
    main: umamusumeData.main,
    eventList: umamusumeData.eventList,
    skills: umamusumeData.skillList,
  };
  const getImg = getImgFn(videoElement);

  render.initDOM();
  render.getImg = getImg;
  Object.assign(render.data, data);
};

