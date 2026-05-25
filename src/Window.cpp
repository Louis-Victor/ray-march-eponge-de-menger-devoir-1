#include "Window.h"
#include <GL/glew.h>
#include <GLFW/glfw3.h>
#include "glHelper.h"
#include <iostream>


Window::Window(): width(800),height(600),label("Window"){}
Window::Window(int p_width, int p_height, const char* p_label): width(p_width), height(p_height), label(p_label){
	GLFWmonitor* monitor = glfwGetPrimaryMonitor();
	const GLFWvidmode* mode = glfwGetVideoMode(monitor);

    _close = false;
    // Creates the GLFWwindow pointer
    window = glfwCreateWindow(mode->width,mode->height,label,monitor,NULL);

    // If the creation failed
    if(window == NULL){
        std::cout << "Failed to create " << label << "\n";
    }else{
        std::cout << label << " created successfuly\n";
        // Display window
        glfwMakeContextCurrent(window);
		glfwSwapInterval(1); // VSYNC

        // Set up rendering window size
        glViewport(0,0,width,height);

        // Set resize function
        glfwSetFramebufferSizeCallback(window,framebuffer_size_callback);

        //  Set cursor callback
        glfwSetCursorPosCallback(window, mouse_callback);
    }
    glfwSetInputMode(window, GLFW_CURSOR, GLFW_CURSOR_DISABLED);  
}
Window::~Window(){
    this->close();
}

// The render method to put in the main loop
void Window::render(){
    // Swaps colour buffer
    glfwSwapBuffers(window);

    // Check for event
    glfwPollEvents();
}

bool Window::isClosed(){
    return glfwWindowShouldClose(window);
}

GLFWwindow* Window::getWindow(){
    return window;
}
int Window::getWidth(){
    return width;
}
int Window::getHeight(){
    return height;
}
const char* Window::getLabel(){
    return label;
}

// Closes the window
void Window::close(){
    if(_close) return
    glfwSetWindowShouldClose(window,true);
    std::cout << "Window " << label << " " << this << " closed\n";
    _close = true;
}

// gets the state of a key
// https://www.glfw.org/docs/3.3/group__input.html1
int Window::getInput(int key) const{
    return glfwGetKey(window,key);
}

// clears the screen with black
void Window::clear(){
    clear(0.0f,0.0f,0.0f);
    glEnable(GL_DEPTH_TEST);
    glClear(GL_COLOR_BUFFER_BIT | GL_DEPTH_BUFFER_BIT);

}

// clears the screen with rgb colour
void Window::clear(float r, float g, float b){
    clear(r,g,b,1.0f);
}

// clears the screen with rgba colour
void Window::clear(float r, float g, float b, float alpha){
    glClearColor(r,g,b,alpha);
    glEnable(GL_DEPTH_TEST);
    glClear(GL_COLOR_BUFFER_BIT | GL_DEPTH_BUFFER_BIT);
}
