// provider
const cloudbase = require('@cloudbase/node-sdk');
const { syncAlgolia } = require('./sync-to-search');
const config = {
  secretId: 'AKIDXsxmKcdNq3ze2A1aste8LHxLTKvFI4Yp', // 前往「腾讯云控制台」-「访问密钥」获取
  secretKey: process.env.TENCENT_SECRET_KEY, // 前往「腾讯云控制台」-「访问密钥」获取
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
async function addDocuments(data) {
  const db = app.database();
  const oldDocs = await db
    .collection(DOCUMENT)
    .where({
      type: 'webpack',
    })
    .field({ hash: true, path: true })
    .limit(200)
    .get();

  const oldHash = getDocsHash(oldDocs.data);
  const newHash = getDocsHash(data);

  const addDocs = [];
  const updateDocs = [];
  const deleteDocs = [];

  data.forEach((doc) => {
    const path = doc.path;
    // add，path not match, new instead of old
    if (!oldHash[path] && newHash[path]) {
      addDocs.push(doc);
    }
    // update，path match but hash non-match
    else if (
      oldHash[path] &&
      newHash[path] &&
      oldHash[path].hash !== newHash[path].hash
    ) {
      updateDocs.push({
        _id: oldHash[path]._id,
        ...doc,
      });
    }
  });

  oldDocs.data.forEach((doc) => {
    const path = doc.path;

    // delete，path not match, old instead of instead
    if (!newHash[path]) {
      deleteDocs.push(doc);
    }
  });

  // console.log("addDocs", addDocs)
  // console.log("updateDocs", updateDocs)
  // console.log("deleteDocs", deleteDocs)

  if (!addDocs.length && !updateDocs.length && !deleteDocs.length) {
    return;
  }

  if (addDocs.length) {
    const addResult = await db.collection(DOCUMENT).add(addDocs);
    console.log('addResult', addResult.ids || addResult.id); // 打印添加的docId
  }

  for (let i = 0; i < updateDocs.length; i++) {
    const updateDoc = updateDocs[i];
    const id = updateDoc._id;
    delete updateDoc._id;

    const updateResult = await db
      .collection(DOCUMENT)
      .doc(id)
      .update(updateDoc);

    console.log('updateResult', updateResult.updated); // 更新的条数
  }

  for (let i = 0; i < deleteDocs.length; i++) {
    const deleteDoc = deleteDocs[i];

    const deleteResult = await db
      .collection(DOCUMENT)
      .doc(deleteDoc._id)
      .delete();

    console.log('deleteResult', deleteResult.deleted); // 删除成功的条数
  }

  await syncAlgolia({
    addDocs,
    updateDocs,
    deleteDocs,
  });
}

function getDocsHash(docs) {
  return docs.reduce((pre, cur) => {
    pre[cur.path] = cur;
    return pre;
  }, {});
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
