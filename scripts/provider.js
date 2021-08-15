// provider
const cloudbase = require('@cloudbase/node-sdk');
// Todo: 写进 Github 环境变量里
const config = {
  secretId: 'AKIDXsxmKcdNq3ze2A1aste8LHxLTKvFI4Yp', // 前往「腾讯云控制台」-「访问密钥」获取
  secretKey: '1lERt50f39yWnnWyB7m9G6fxxhAON6Zm', // 前往「腾讯云控制台」-「访问密钥」获取
  env: 'docschina-live-10765e', // 前往「腾讯云控制台」-「云开发 CloudBase」获取
};
const app = cloudbase.init(config);

const DOCUMENT = 'integration_document';
const SIDEBAR = 'integration_document_sidebar';
/**
 * 获取云数据库文档数据
 */
async function getDocument() {
  const db = app.database();
  const result = await db
    .collection(DOCUMENT)
    .where({
      type: 'webpack',
    })
    .limit(200)
    .get();
  if (result.code) {
    throw new Error(
      `获取「文档」失败, 错误码是${result.code}: ${result.message}`
    );
  }
  return result.data.map((item) => {
    if (item.createTime instanceof Date) {
      item.createTime = item.createTime.toLocaleString();
    }
    if (item.updateTime instanceof Date) {
      item.updateTime = item.updateTime.toLocaleString();
    }
    // item.cover = getBucketUrl(item.cover); // 处理云存储的特殊链接
    return item;
  });
}

/**
 * 插入云数据库文档数据
 */
async function addDocuments(documents) {
  const db = app.database();
  const result = await db.collection(DOCUMENT).add(documents);

  console.log('result', result);
  if (result.code) {
    throw new Error(
      `插入「文档」失败, 错误码是${result.code}: ${result.message}`
    );
  }
  return result;
}

/**
 * 获取云数据库侧边栏数据
 */
async function getSidebar() {
  const db = app.database();
  const result = await db
    .collection(SIDEBAR)
    .where({
      type: 'webpack',
    })
    .get();
  if (result.code) {
    throw new Error(
      `获取「侧边栏」失败, 错误码是${result.code}: ${result.message}`
    );
  }
  return result.data;
}

/**
 * 插入云数据库侧边栏数据
 */
async function addSidebar(sidebar) {
  // diff
  const old = await getSidebar();
  const db = app.database();
  let result = {};

  if (old.length) {
    // 更新
    console.log('更新数据');
    const record = old.find((item) => item.name === sidebar.name);

    result = await db.collection(SIDEBAR).doc(record._id).update(sidebar);
  } else {
    // 新增
    console.log('新增数据');
    result = await db.collection(SIDEBAR).add(sidebar);
  }

  if (result.code) {
    throw new Error(
      `插入「侧边栏」失败, 错误码是${result.code}: ${result.message}`
    );
  }
  return result;
}

module.exports.getDocument = getDocument;
module.exports.addDocuments = addDocuments;
module.exports.addSidebar = addSidebar;
