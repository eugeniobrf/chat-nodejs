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
    const {err} = req.query;
    salas = [];
    for (let i=1; i<=10 ; i++){
        if(socket.sockets.adapter.rooms[i]){
           salas.push({"id":i,"conectados":socket.sockets.adapter.rooms[i].length}); 
        }else{
            salas.push({"id":i,"conectados":0})
        }
    }
    res.render('salas.ejs',{salas,'erro':err});
});

//rota da sala do chat
app.use('/sala/:id',(req,res)=>{
    const {nick} = req.query;
    const sala = req.params.id;
    if(socket.sockets.adapter.rooms[sala]){
        if(socket.sockets.adapter.rooms[sala].length==1 && Object.keys(socket.sockets.adapter.rooms[sala].sockets).indexOf(sala)==0){
            //sala pessoal
            req.query.err = 1;
            return res.redirect('/salas?err=1');
        }
        if(socket.sockets.adapter.rooms[sala].length>=4){
            //sala cheia
            return res.redirect('/salas?err=2');
        }
    }
    const link = 'http://localhost:3333/'
    res.render('chat.ejs',{sala,nick,link}); 
});

//caso se tente acessar um caminho inválido, redireciona para a tela de seleção de sala
app.use('*',(req,res)=>{
    res.redirect('/salas');
});

//manipulação do socket.io
socket.on('connection',s=> {
    console.log(s.id);
    s.on('joinRoom',(d)=>{
        let entra;
        //verifica se a sala é não pessoal
        if(!socket.sockets.adapter.rooms[d.sala]){
            //sala ainda nao existe
            entra=true;
        }else{
            if(socket.sockets.adapter.rooms[d.sala].length==1 && Object.keys(socket.sockets.adapter.rooms[d.sala].sockets).indexOf(d.sala)==0){
                //sala com uma unica pessoa com nome da sala igual ao unico membro da sala (sala pessoal)
                entra=false;
                s.emit('erro',{'erro':'1'})
            }else{
                if(socket.sockets.adapter.rooms[d.sala].length>=4){
                    //sala cheia
                    entra=false;
                    s.emit('erro',{'erro':'2'});
                }
                entra=true;
            }  
        }
        if(entra){
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