#!/usr/bin/env python

import socket, threading, time, base64, hashlib, struct, binascii
from SimpleWebSocketServer import WebSocket, SimpleWebSocketServer

def receive_next_chunk(GET, source, sock, size, header_length):
	data = sock.recv(size)
	prev_size = 0
	while len(data) < size:
	    prev_size = len(data)
	    data += sock.recv(size - len(data))
	return data, sock

class SimpleEcho(WebSocket):

        def handleMessage(self):
            pass

        def handleConnected(self):
            print self.address, 'connected'
	    
	    source_socket = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
	    GET_message = 'GET ' + "/consume/first" + ' HTTP/1.1\r\n'
	    GET_message += '\r\n'
	    source = ("127.0.0.1", 8080) #("150.214.150.68", 4551)
	    print source_socket.getsockname(), 'connecting to the source', source, '...'
	    source_socket.connect(source)
	    print source_socket.getsockname(), 'connected to', source
	    source_socket.sendall(GET_message)
            
            #while True:
	    chunk, source_socket = receive_next_chunk(GET_message, source, source_socket, 1024, 0)
	    print chunk
	    self.sendMessage(binascii.hexlify(chunk))


        def handleClose(self):
            print self.address, 'closed'         

if __name__ == '__main__':
    server = SimpleWebSocketServer('', 9876, SimpleEcho)
    server.serveforever()


