#ifndef __WINDOW__
#define __WINDOW__
#include <GL/glew.h>
#include <GLFW/glfw3.h>
#include <iostream>

// Window class
class Window{
    private:
        GLFWwindow* window;
        int width, height;
        const char* label;
        bool _close;

    public:
        Window();
        Window(int p_width, int p_height, const char* p_label);
        ~Window();
        void render();
        bool isClosed();
        GLFWwindow* getWindow();
        int getWidth();
        int getHeight();
        const char* getLabel();
        void close();
        int getInput(int key) const;
        void clear();
        void clear(float r, float g, float b);
        void clear(float r, float g, float b, float alpha);
};


#endif
