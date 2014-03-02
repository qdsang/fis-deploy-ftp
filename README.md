# fis-deploy-ftp

将代码通过ftp的方式上传

```
fis.config.merge({
    modules : {
        deploy : 'ftp'
    },
    settings : {
        deploy : {
            'ftp' : {
			    remoteDir : '/',
			    connect : {
			        host : '127.0.0.1',
			        port : '21',
			        user : 'name',
			        password : '****'
			    }
			}
        }
    }
});
```