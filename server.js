const express=require('express');
const http = require('http');
const io = require('socket.io');
const ejs = require('ejs');

const app = express();
const server = http.createServer(app);
const socket = io(server);

app.use(express.static('public'));
app.set('views','public');
app.engine('html',ejs.renderFile);
app.set('view engine', 'html');

//rota para se listar as salas ativas
app.use('/salas',(req,res)=>{
    salas = [];
    for (let i=1; i<=10 ; i++){
        if(socket.sockets.adapter.rooms[i]){
           salas.push({"id":i,"conectados":socket.sockets.adapter.rooms[i].length}); 
        }else{
            salas.push({"id":i,"conectados":0})
        }
    }
    res.render('salas.ejs',{salas});
});

//rota da sala do chat
app.use('/sala/:id',(req,res)=>{
    const {nick} = req.query;
    const sala = req.params.id;
    res.render('chat.ejs',{sala,nick}); 
});

//caso se tente acessar um caminho inválido, redireciona para a tela de seleção de sala
app.use('*',(req,res)=>{
    res.redirect('/salas');
});

//manipulação do socket.io
socket.on('connection',s=> {
    
    s.on('joinRoom',(d)=>{
        //verifica se a sala a qual se deseja entrar é valida
        if(d.sala>=1 && d.sala<=10){
            s.sala=d.sala;
            //caso nao se passe um nick, seta ele com o id padrao gerado pelo socket.io
            if(!d.nick){
                s.nick=s.id;
            }else{
                s.nick = d.nick;
            }
            s.join(s.sala);
            //avisa a todos da sala q alguem entrou
            s.to(s.sala).emit('resposta',{"msg":'Entrou!',"autor":s.nick});
            s.emit('resposta',{"msg":'Entrou!',"autor":s.nick});
        }else{
            s.emit('erro','Sala inválida!!!')
        }
    })

    s.on('mensagem',
        (d)=>{
            const msg = d.mensagem;
            const autor = s.nick;
            s.to(s.sala).emit('resposta',{msg,autor});
            s.emit('resposta',{msg,autor});
        }
    );
    
    //quando se disconecta, independente do motivo, simplesmente se "apaga" o socket
    s.on('disconnect', (razao) => {
        //avisa q o usuario deixou a sala
        if(s.sala){
            s.to(s.sala).emit('resposta',{"msg":"Saiu!","autor":s.nick});
        }
        s.leaveAll();
    });
});

server.listen(3333,()=>console.log('Server iniciado!'));