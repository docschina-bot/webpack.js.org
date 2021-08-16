const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const glob = require('glob');
const matter = require('gray-matter');

const cwd = path.resolve(__dirname, '../src/content');
const { addDocuments, addSidebar, getDocument } = require('./provider');

// options is optional
glob(cwd + '/**/*.md{,x}', {}, async function (err, files) {
  // files is an array of filenames.
  // If the `nonull` option is set, and nothing
  // was found, then files is ["**/*.js"]
  // er is an error object or null.

  const allData = files.slice(0).map((file) => {
    const data = getData(file);
    // fs.writeFileSync(file + '.xxx',JSON.stringify(data,null,2),'utf-8');
    return data;
  });

  await addDocuments(allData);
  const sidebar = await getSidebar(allData);
  await addSidebar(sidebar);
});

async function getSidebar(data) {
  // Todo: 支持生成有 type 为 group 的嵌套侧边栏
  const oneSidebar = data.map((item) => {
    return {
      key: item.path,
      path: `/docs/${item.path}/`,
      title: item.title,
      type: 'page',
    };
  });
  const docs = await getDocument();
  const hash = crypto
    .createHash('md5')
    .update(JSON.stringify(oneSidebar))
    .digest('hex');

  return {
    name: 'Webpack 文档站侧边栏',
    value: oneSidebar,
    pages: docs.map((item) => item._id),
    hash,
    type: 'webpack',
  };
}

function getData(file) {
  const json = matter(fs.readFileSync(file, 'utf-8'));

  const content = formatContent(json.content);
  const hash = crypto
    .createHash('md5')
    .update(JSON.stringify(json.data) + content)
    .digest('hex');

  let docPath =
    `webpack/` + path.relative(cwd, file).split('.').slice(0, -1).join('.');

  docPath = docPath.replace(/\/index$/i, '');

  return {
    title: json.data.title,
    content,
    path: docPath,
    frontMatter: json.data,
    hash,
    type: 'webpack',
  };
}

function formatContent(content) {
  let newContent = content
    .replace(
      /T>(.*)\n/g,
      `::: tip 
  $1
  :::
  `
    )
    .replace(
      /W>(.*)\n/g,
      `::: warning 
  $1
  :::
  `
    )
    .replace(
      /\?>(.*)\n/g,
      `::: tip Todo 
  $1
  :::
  `
    )
    .replace(
      `<img src="/assets`,
      `<img src="https://raw.githubusercontent.com/webpack/webpack.js.org/master/src/assets`
    );

  return newContent;
}
