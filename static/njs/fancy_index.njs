// fancy_index.njs - NJS module for fancy index rendering
// 参考 tuna/mirror-web 实现的 FancyIndex NJS 模块

/**
 * 简单的模板渲染函数，替换 Mark.up
 * @param {string} template - 模板字符串
 * @param {Object} data - 数据对象
 * @returns {string} 渲染结果
 */
function markUp(template, data) {
    var result = template;
    for (var key in data) {
        if (data.hasOwnProperty(key)) {
            var placeholder = '{{' + key + '}}';
            var value = data[key];
            if (typeof value === 'string') {
                result = result.replace(new RegExp(placeholder, 'g'), value);
            }
        }
    }
    return result;
}

/**
 * 处理 fancy index 模板渲染
 * @param {Object} r - nginx request object
 * @param {string} templateUrl - 模板 URL
 */
function fancyIndexRender(r, templateUrl) {
    r.subrequest(
        templateUrl,
        {
            args: '',
            body: '',
            method: 'GET'
        },
        function (rTmpl) {
            if (rTmpl.status !== 200) {
                r.return(rTmpl.status);
                return;
            }
            
            var tmpl = rTmpl.responseText;
            var url = r.variables.request_uri.replace(/\/+/g, '/').replace(/\?.*$/, '');
            
            var result = markUp(tmpl, {
                url: url
            });
            
            r.status = 200;
            r.headersOut['Content-Type'] = 'text/html; charset=utf-8';
            r.sendHeader();
            r.send(result);
            r.finish();
        }
    );
}

/**
 * 渲染 before 模板
 * @param {Object} r - nginx request object
 */
function fancyIndexBeforeRender(r) {
    fancyIndexRender(r, '/fancy-index/before.html');
}

/**
 * 渲染 after 模板
 * @param {Object} r - nginx request object
 */
function fancyIndexAfterRender(r) {
    fancyIndexRender(r, '/fancy-index/after.html');
}

// 导出函数供 nginx 使用
export default { 
    fancyIndexBeforeRender, 
    fancyIndexAfterRender
};
