# fis-deploy-ftp

将代码通过ftp的方式上传, 注意：将FIS产出上传至BCS 仅支持FIS 1.8.5+

启用

```
fis.config.set('modules.deploy', ['default', 'ftp'])
```

配置

```
fis.config.set('settings.deploy.ftp', {
    publish : {
        remoteDir : '/temp/',

        connect : {
            host : '127.0.0.1',
            port : '21',
            user : 'name',
            password : '****'
        }
    }
});
```

发布

```
fis release -Dompd publish
```
